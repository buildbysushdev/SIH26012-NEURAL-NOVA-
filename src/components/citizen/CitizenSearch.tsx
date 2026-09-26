import { useState, type FormEvent } from "react";
import { Search as SearchIcon } from "lucide-react";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function CitizenSearch({ onSearch, loading }: { onSearch: (q: string) => void; loading?: boolean }) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Project ID, project name, or location..."
            icon={<SearchIcon size={16} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="lg" loading={loading} className="flex-1 sm:flex-none">
            Search Project
          </Button>
        </div>
      </div>
    </form>
  );
}
