"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type CalendarProps = {
  selected?: Date;
  onSelect?: (date?: Date) => void;
  disabled?: (date: Date) => boolean;
  fromDate?: Date;
  toDate?: Date;
  className?: string;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function Calendar({ selected, onSelect, disabled, fromDate, toDate, className }: CalendarProps) {
  const initial = selected ?? new Date();
  const [viewYear, setViewYear] = React.useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial.getMonth());

  React.useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [selected?.getFullYear(), selected?.getMonth()]);

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const year = viewYear;
  const month = viewMonth;
  const total = daysInMonth(year, month);
  const start = startWeekday(year, month);
  const today = new Date();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = new Array(start).fill(null);
  for (let day = 1; day <= total; day++) {
    const date = new Date(year, month, day);
    week.push(date);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const isDisabled = (d: Date) => {
    if (fromDate && d < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) return true;
    if (toDate && d > new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())) return true;
    return disabled?.(d) ?? false;
  };

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
  const isSameDay = (a?: Date, b?: Date) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div className={cn("p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={goPrev} className={cn(buttonVariants({ variant: "outline" }), "size-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-sm font-medium">{monthLabel}</div>
        <button onClick={goNext} className={cn(buttonVariants({ variant: "outline" }), "size-7 bg-transparent p-0 opacity-50 hover:opacity-100")}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[0.8rem] text-muted-foreground">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {weeks.flatMap((row, i) =>
          row.map((d, j) => {
            if (!d) return <div key={`${i}-${j}`} />;
            const disabledDay = isDisabled(d);
            const selectedDay = isSameDay(d, selected);
            const todayDay = isSameDay(d, today);
            return (
              <button
                key={`${i}-${j}`}
                onClick={() => !disabledDay && onSelect?.(d)}
                disabled={disabledDay}
                className={cn(
                  buttonVariants({ variant: selectedDay ? "default" : "ghost" }),
                  "size-8 p-0 font-normal aria-selected:opacity-100",
                  todayDay && !selectedDay ? "bg-accent text-accent-foreground" : "",
                  disabledDay ? "cursor-not-allowed opacity-60" : "",
                )}
                aria-selected={selectedDay}
                aria-disabled={disabledDay}
                title={disabledDay ? "Out of Annadanam season" : undefined}
              >
                <span className="relative inline-flex items-center justify-center w-full h-full">
                  <span className={cn(disabledDay ? "line-through" : "")}>{d.getDate()}</span>
                  {disabledDay ? (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center text-destructive/70"
                      style={{ pointerEvents: "none" }}
                    >
                      ×
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
