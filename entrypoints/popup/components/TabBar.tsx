interface TabBarProps {
  activeTab: "dashboard" | "activity" | "about";
  onTabChange: (tab: "dashboard" | "activity" | "about") => void;
}

const TABS: { id: "dashboard" | "activity" | "about"; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "activity", label: "Activity Log" },
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
