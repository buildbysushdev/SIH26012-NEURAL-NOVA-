import clsx from "clsx";

export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <div className="flex gap-1 min-w-max px-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              active === tab
                ? "border-navy-800 text-navy-800"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
