import React, { useState, useEffect, useMemo } from 'react';

interface DateRangeCalendarProps {
  minDate: string; // 'YYYY-MM-DD'
  maxDate: string; // 'YYYY-MM-DD'
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  onChange: (start: string, end: string) => void;
}

export const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  minDate,
  maxDate,
  startDate,
  endDate,
  onChange,
}) => {
  // Parse strict YYYY-MM-DD to avoid timezone shifting
  const parseDate = (dStr: string) => {
    if (!dStr) return null;
    const [y, m, d] = dStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const minD = parseDate(minDate);
  const maxD = parseDate(maxDate);
  const selStart = parseDate(startDate);
  const selEnd = parseDate(endDate);

  // The month currently being viewed in the calendar
  const [viewDate, setViewDate] = useState<Date>(selStart || maxD || new Date());
  
  // Hover tracking for range preview
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  
  // Are we selecting the start date or end date on the next click?
  // If both are selected, clicking again restarts selection at START.
  const [selectionMode, setSelectionMode] = useState<'START' | 'END'>(startDate && endDate ? 'START' : 'START');

  // When props change (e.g. initial load), ensure we view a relevant month
  useEffect(() => {
    if (selStart) {
      setViewDate(new Date(selStart.getFullYear(), selStart.getMonth(), 1));
    }
  }, [startDate]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    // Padding for previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }
    return days;
  }, [viewYear, viewMonth, daysInMonth, firstDayOfWeek]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleDayClick = (day: Date) => {
    // Prevent clicking disabled days
    if (minD && day < minD) return;
    if (maxD && day > maxD) return;

    const dayStr = formatDate(day);

    if (selectionMode === 'START' || (selStart && selEnd)) {
      // Start fresh
      onChange(dayStr, '');
      setSelectionMode('END');
    } else {
      // We are selecting END
      if (selStart && day >= selStart) {
        onChange(startDate, dayStr);
        setSelectionMode('START');
      } else {
        // If they clicked a day BEFORE the start date, treat it as a new start date
        onChange(dayStr, '');
        setSelectionMode('END');
      }
    }
  };

  const handleDayMouseEnter = (day: Date) => {
    setHoverDate(day);
  };

  const isSelected = (day: Date) => {
    if (!day) return false;
    const time = day.getTime();
    return (selStart && time === selStart.getTime()) || (selEnd && time === selEnd.getTime());
  };

  const isBetween = (day: Date) => {
    if (!day || !selStart) return false;
    const time = day.getTime();
    
    // Confirmed range
    if (selEnd && time > selStart.getTime() && time < selEnd.getTime()) {
      return true;
    }
    
    // Hover preview range
    if (!selEnd && hoverDate && selectionMode === 'END') {
      if (hoverDate > selStart && time > selStart.getTime() && time <= hoverDate.getTime()) {
        return true;
      }
    }
    return false;
  };

  const isDisabled = (day: Date) => {
    if (!day) return true;
    if (minD && day < minD) return true;
    if (maxD && day > maxD) return true;
    return false;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-4 select-none">
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={handlePrevMonth}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-bold text-slate-800 text-[15px]">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button 
          onClick={handleNextMonth}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {dayNames.map(name => (
          <div key={name} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {calendarDays.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-9"></div>;

          const selected = isSelected(day);
          const between = isBetween(day);
          const disabled = isDisabled(day);
          
          const isStart = selStart && day.getTime() === selStart.getTime();
          const isEnd = selEnd && day.getTime() === selEnd.getTime();
          const isPreviewEnd = !selEnd && hoverDate && day.getTime() === hoverDate.getTime() && day > selStart!;

          let bgClass = "bg-transparent text-slate-700 hover:bg-slate-100";
          if (disabled) {
            bgClass = "bg-transparent text-slate-300 cursor-not-allowed line-through decoration-slate-200";
          } else if (selected || isPreviewEnd) {
            bgClass = "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20";
          } else if (between) {
            bgClass = "bg-emerald-50 text-emerald-800";
          }

          let wrapperClass = "h-9 flex items-center justify-center relative";
          
          // Connect the background colors for ranges
          if (between || selected || isPreviewEnd) {
             if (isStart && (selEnd || hoverDate! > selStart!)) wrapperClass += " bg-gradient-to-r from-transparent to-emerald-50";
             else if (isEnd || isPreviewEnd) wrapperClass += " bg-gradient-to-l from-transparent to-emerald-50";
             else wrapperClass += " bg-emerald-50";
          }

          return (
            <div 
              key={idx} 
              className={wrapperClass}
              onMouseEnter={() => !disabled && handleDayMouseEnter(day)}
            >
              <button
                disabled={disabled}
                onClick={() => handleDayClick(day)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all ${bgClass}`}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
