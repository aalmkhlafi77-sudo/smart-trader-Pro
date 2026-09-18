import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Building2, ClipboardList, FileText, Package, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  db,
  type CargoCostRunRow,
  type EntityRow,
  type ItemRow,
  type TaskRow,
} from "@/lib/db";

interface SearchIndex {
  entities: EntityRow[];
  items: ItemRow[];
  specsByItem: Record<string, string>;
  runs: CargoCostRunRow[];
  tasks: TaskRow[];
}

export function GlobalSearchButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between bg-card text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2 text-xs">
          <Search className="h-3.5 w-3.5" />
          {t("home.searchTitle")}...
        </span>
        <kbd
          className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold"
          dir="ltr"
        >
          Ctrl+K
        </kbd>
      </Button>
      <GlobalSearch open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    let cancelled = false;
    (async () => {
      await db.init();
      const [entities, items, runs, tasks] = await Promise.all([
        db.listEntities(),
        db.listItems(),
        db.listCargoCostRuns(),
        db.listTasks(),
      ]);
      const specsByItem: Record<string, string> = {};
      await Promise.all(
        items.map(async item => {
          const specs = await db.listSpecsByItem(item.id);
          specsByItem[item.id] = specs
            .map(s => `${s.label} ${s.value} ${s.unit}`)
            .join(" ");
        })
      );
      if (cancelled) return;
      setIndex({ entities, items, specsByItem, runs, tasks });
    })();
    return () => {
      cancelled = true;
    };
  }, [open ]);

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!index || !q) return null;
    const has = (text: string) => text.toLowerCase().includes(q);
    return {
      entities: index.entities
        .filter(e => has(`${e.name} ${e.country} ${e.city}`))
        .slice(0, 6),
      items: index.items
        .filter(
          i =>
            has(`${i.name} ${i.code} ${i.category}`) ||
            has(index.specsByItem[i.id] ?? "")
        )
        .slice(0, 6),
      runs: index.runs
        .filter(r => has(`${r.name} ${r.reference}`))
        .slice(0, 6),
      tasks: index.tasks
        .filter(x => has(`${x.title} ${x.details}`))
        .slice(0, 6),
    };
  }, [index, q]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("home.searchTitle")}</DialogTitle>
          <DialogDescription>{t("home.searchPlaceholder")}</DialogDescription>
        </DialogHeader>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={t("home.searchPlaceholder")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{t("common.nomatchingrecordsfound")}</CommandEmpty>
            {results ? (
              <>
                {results.items.length > 0 ? (
                  <CommandGroup heading={t("items.title")}>
                    {results.items.map(item => (
                      <CommandItem
                        key={item.id}
                        value={`item-${item.id}`}
                        onSelect={() => go(`/items?q=${encodeURIComponent(item.name)}`)}
                      >
                        <Package className="h-4 w-4" />
                        <span className="truncate">
                          {item.name}
                          {item.code ? (
                            <span className="text-muted-foreground" dir="ltr">
                              {" "}[{item.code}]
                            </span>
                          ) : null}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {results.entities.length > 0 ? (
                  <CommandGroup heading={t("entities.title")}>
                    {results.entities.map(entity => (
                      <CommandItem
                        key={entity.id}
                        value={`entity-${entity.id}`}
                        onSelect={() => go("/entities")}
                      >
                        <Building2 className="h-4 w-4" />
                        <span className="truncate">{entity.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {results.runs.length > 0 ? (
                  <CommandGroup heading={t("cargo.runsTitle")}>
                    {results.runs.map(run => (
                      <CommandItem
                        key={run.id}
                        value={`run-${run.id}`}
                        onSelect={() => go(`/cargo?runId=${run.id}`)}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="truncate">{run.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {results.tasks.length > 0 ? (
                  <CommandGroup heading={t("followup.title")}>
                    {results.tasks.map(task => (
                      <CommandItem
                        key={task.id}
                        value={`task-${task.id}`}
                        onSelect={() => go("/follow-up")}
                      >
                        <ClipboardList className="h-4 w-4" />
                        <span className="truncate">{task.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
