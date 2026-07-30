interface TabBarProps {
  activeTab: "dashboard" | "activity" | "settings" | "about";
  onTabChange: (tab: "dashboard" | "activity" | "settings" | "about") => void;
}

const TABS: {
  id: "dashboard" | "activity" | "settings" | "about";
  label: string;
}[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
  { id: "about", label: "About" },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
