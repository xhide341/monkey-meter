// ── Content Script: URL change detection + educational classifier + overlay UI ──

import type { ExtensionMessage, OverlayResponse } from "@/lib/types";
import {
  EDUCATIONAL_KEYWORDS,
  RAPID_NAV_WINDOW_MS,
  RAPID_NAV_THRESHOLD,
} from "@/lib/constants";
import { extractDomain, isShortContent } from "@/lib/events";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main(ctx) {
    const domain = extractDomain(window.location.href);

    // ── Educational content detection via page metadata ──
    // Track whether we've already notified the background for this domain
    let educationalNotified = false;
    classifyPageContent(domain);

    /**
     * Check page title, meta description, and keywords for educational signals
     * by combining all metadata into one searchable string.
     * If found, notify the background to discount drift events for this domain.
     * Only sends one notification per content script instance.
     */
    function classifyPageContent(domain: string) {
      if (educationalNotified) return;

      const title = document.title.toLowerCase();
      const metaDesc =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content")
          ?.toLowerCase() ?? "";
      const metaKeywords =
        document
          .querySelector('meta[name="keywords"]')
          ?.getAttribute("content")
          ?.toLowerCase() ?? "";
      const ogTitle =
        document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content")
          ?.toLowerCase() ?? "";

      const combined = `${title} ${metaDesc} ${metaKeywords} ${ogTitle}`;

      const matchedKeyword = EDUCATIONAL_KEYWORDS.find((kw) =>
        combined.includes(kw),
      );

      if (matchedKeyword) {
        educationalNotified = true;
        console.log(
          `[MM Content] Educational page detected: "${document.title}" (matched: "${matchedKeyword}")`,
        );
        browser.runtime.sendMessage({
          type: "PAGE_EDUCATIONAL",
          domain,
          title: document.title,
        } satisfies ExtensionMessage);
      }
    }

    /**
     * Track how often the URL changes within a rolling window as a primary drift signal.
     * Polls every 1 second to handle SPA sites (pushState/replaceState). On change:
     * records the navigation timestamp, prunes old timestamps outside the rolling window,
     * checks for short content, re-classifies educational content after a small delay,
     * and notifies background if the rapid navigation threshold is met.
     */
    let lastUrl = window.location.href;
    const navTimestamps: number[] = [];

    const urlCheckInterval = ctx.setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const now = Date.now();

        navTimestamps.push(now);

        const cutoff = now - RAPID_NAV_WINDOW_MS;
        while (navTimestamps.length > 0 && navTimestamps[0] < cutoff) {
          navTimestamps.shift();
        }

        console.log(
          `[MM Content] URL changed (${navTimestamps.length} navs in ${RAPID_NAV_WINDOW_MS / 1000}s): ${currentUrl}`,
        );

        if (isShortContent(currentUrl)) {
          console.log(`[MM Content] Short content detected: ${currentUrl}`);
        }

        setTimeout(() => classifyPageContent(domain), 1500);

        if (navTimestamps.length >= RAPID_NAV_THRESHOLD) {
          console.log(
            `[MM Content] Rapid navigation detected: ${navTimestamps.length} URL changes in ${RAPID_NAV_WINDOW_MS / 1000}s`,
          );
          browser.runtime.sendMessage({
            type: "RAPID_NAVIGATION",
            domain,
            navCount: navTimestamps.length,
          } satisfies ExtensionMessage);
        }
      }
    }, 1000);

    // ── Overlay message listener ──
    browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === "SHOW_OVERLAY") {
        showReflectiveOverlay(message.score, domain);
      }
    });

    /** 
     * Inject the reflective overlay into the page if one does not already exist.
     * Applies inline styles to avoid CSS conflicts with the host page, handles slide-in
     * animation, configures action buttons with fade-out removal, and sets an auto-dismiss
     * timeout of 15 seconds.
     */
    function showReflectiveOverlay(score: number, domain: string) {
      if (document.getElementById("mm-overlay")) return;

      const overlay = document.createElement("div");
      overlay.id = "mm-overlay";
      overlay.innerHTML = `
        <div class="mm-overlay-card">
          <div class="mm-overlay-icon">🐵</div>
          <div class="mm-overlay-text">Are we here on purpose?</div>
          <div class="mm-overlay-score">Autopilot Score: ${Math.round(score)}%</div>
          <div class="mm-overlay-buttons">
            <button class="mm-btn mm-btn-intentional" data-action="intentional">
              ✅ Intentional
            </button>
            <button class="mm-btn mm-btn-monkey" data-action="monkey_mode">
              🐒 Monkey Mode
            </button>
            <button class="mm-btn mm-btn-suppress" data-action="dont_ask_again">
              🔇 Don't Ask Again
            </button>
          </div>
        </div>
      `;

      applyOverlayStyles(overlay);

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        const card = overlay.querySelector(".mm-overlay-card") as HTMLElement;
        if (card) card.style.transform = "translateX(0)";
      });

      overlay.querySelectorAll(".mm-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const action = (e.currentTarget as HTMLElement).dataset
            .action as OverlayResponse;

          browser.runtime.sendMessage({
            type: "OVERLAY_RESPONSE",
            response: action,
            domain,
          } satisfies ExtensionMessage);

          overlay.style.opacity = "0";
          setTimeout(() => overlay.remove(), 300);
        });
      });

      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.style.opacity = "0";
          setTimeout(() => overlay.remove(), 300);
        }
      }, 15000);
    }

    /** Apply all styles inline to avoid CSS conflicts with host pages */
    function applyOverlayStyles(overlay: HTMLElement) {
      Object.assign(overlay.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: "2147483647",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        transition: "opacity 0.3s ease",
        opacity: "1",
      });

      const card = overlay.querySelector(".mm-overlay-card") as HTMLElement;
      if (card) {
        Object.assign(card.style, {
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          borderRadius: "16px",
          padding: "20px 24px",
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.08)",
          color: "#e2e8f0",
          maxWidth: "320px",
          transform: "translateX(120%)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        });
      }

      const icon = overlay.querySelector(".mm-overlay-icon") as HTMLElement;
      if (icon) {
        Object.assign(icon.style, {
          fontSize: "32px",
          marginBottom: "8px",
          textAlign: "center",
        });
      }

      const text = overlay.querySelector(".mm-overlay-text") as HTMLElement;
      if (text) {
        Object.assign(text.style, {
          fontSize: "16px",
          fontWeight: "600",
          textAlign: "center",
          marginBottom: "4px",
          color: "#f1f5f9",
        });
      }

      const scoreEl = overlay.querySelector(".mm-overlay-score") as HTMLElement;
      if (scoreEl) {
        Object.assign(scoreEl.style, {
          fontSize: "12px",
          textAlign: "center",
          color: "#94a3b8",
          marginBottom: "16px",
        });
      }

      const buttons = overlay.querySelector(
        ".mm-overlay-buttons",
      ) as HTMLElement;
      if (buttons) {
        Object.assign(buttons.style, {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        });
      }

      overlay.querySelectorAll(".mm-btn").forEach((btn) => {
        const el = btn as HTMLElement;
        Object.assign(el.style, {
          padding: "10px 16px",
          border: "none",
          borderRadius: "10px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "500",
          transition: "all 0.2s ease",
          textAlign: "center",
        });

        if (el.classList.contains("mm-btn-intentional")) {
          Object.assign(el.style, {
            background: "linear-gradient(135deg, #065f46, #047857)",
            color: "#d1fae5",
          });
        } else if (el.classList.contains("mm-btn-monkey")) {
          Object.assign(el.style, {
            background: "linear-gradient(135deg, #92400e, #b45309)",
            color: "#fef3c7",
          });
        } else if (el.classList.contains("mm-btn-suppress")) {
          Object.assign(el.style, {
            background: "rgba(255, 255, 255, 0.06)",
            color: "#94a3b8",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          });
        }

        el.addEventListener("mouseenter", () => {
          el.style.filter = "brightness(1.2)";
          el.style.transform = "scale(1.02)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.filter = "brightness(1)";
          el.style.transform = "scale(1)";
        });
      });
    }
  },
});
