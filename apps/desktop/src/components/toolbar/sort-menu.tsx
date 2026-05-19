import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import {
  ArrowDownAZ,
  ArrowUpZA,
  Calendar,
  ChevronDown,
  Clock,
} from "lucide-react";
import { type SortField, useGalleryStore } from "@/stores/use-gallery-store";

const sortOptions: {
  field: SortField;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    field: "updatedAt",
    label: "Last Edited",
    icon: <Clock className="size-3" />,
  },
  {
    field: "createdAt",
    label: "Date Added",
    icon: <Calendar className="size-3" />,
  },
  { field: "name", label: "Name", icon: <ArrowDownAZ className="size-3" /> },
];

export function SortMenu() {
  const sortField = useGalleryStore((s) => s.sortField);
  const sortOrder = useGalleryStore((s) => s.sortOrder);
  const setSortField = useGalleryStore((s) => s.setSortField);
  const setSortOrder = useGalleryStore((s) => s.setSortOrder);

  const currentSortOption = sortOptions.find((o) => o.field === sortField);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
        {currentSortOption?.icon}
        <span className="text-xs">{currentSortOption?.label}</span>
        {sortOrder === "desc" ? (
          <ArrowDownAZ className="size-3 text-muted-foreground" />
        ) : (
          <ArrowUpZA className="size-3 text-muted-foreground" />
        )}
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        {sortOptions.map((opt) => (
          <DropdownMenuItem
            key={opt.field}
            onClick={() => setSortField(opt.field)}
          >
            {opt.icon}
            {opt.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
        >
          {sortOrder === "desc" ? (
            <>
              <ArrowUpZA className="size-3" />
              Oldest First / A-Z
            </>
          ) : (
            <>
              <ArrowDownAZ className="size-3" />
              Newest First / Z-A
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
