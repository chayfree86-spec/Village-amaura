import React, { useState, useEffect, useRef } from 'react';

const HINDI_MONTHS = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];

const DAYS_OF_WEEK = ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'];

export default function CustomCalendar({ value, onChange, label, required = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-11
  const calendarRef = useRef(null);

  // Parse input date string DD-MM-YYYY to Date object
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          setCurrentYear(y);
          setCurrentMonth(m);
        }
      }
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Generate calendar days
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const days = [];
  // Empty slots for preceding month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleDateSelect = (day, e) => {
    e.stopPropagation();
    if (!day) return;
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const dateStr = `${formattedDay}-${formattedMonth}-${currentYear}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={calendarRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label} {required && <span className="text-softRed">*</span>}
        </label>
      )}
      
      {/* Date Input Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-sandBeige rounded-xl px-3.5 py-2.5 text-sm md:text-base font-medium flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-riverBlue/30 outline-none shadow-sm"
      >
        <span className={value ? "text-slate-850" : "text-slate-400"}>
          {value || "तारीख चुनें (Select Date)"}
        </span>
        <span className="material-icons-outlined text-riverBlue text-lg flex items-center justify-center">
          calendar_today
        </span>
      </div>

      {/* Calendar Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-sandBeige rounded-2xl shadow-xl z-50 p-4 w-72 md:w-80">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button 
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-riverBlue"
            >
              <span className="material-icons-outlined text-sm">chevron_left</span>
            </button>
            <span className="text-sm font-semibold text-riverBlue">
              {HINDI_MONTHS[currentMonth]} {currentYear}
            </span>
            <button 
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-riverBlue"
            >
              <span className="material-icons-outlined text-sm">chevron_right</span>
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[10px] md:text-xs font-bold text-slate-400">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {days.map((day, idx) => {
              const isSelected = value && (() => {
                const parts = value.split('-');
                return parseInt(parts[0], 10) === day && 
                       parseInt(parts[1], 10) === (currentMonth + 1) && 
                       parseInt(parts[2], 10) === currentYear;
              })();

              return (
                <div
                  key={idx}
                  onClick={(e) => handleDateSelect(day, e)}
                  className={`
                    py-2 rounded-lg font-medium cursor-pointer transition-colors
                    ${!day ? "pointer-events-none opacity-0" : ""}
                    ${isSelected 
                      ? "bg-riverBlue text-white font-bold shadow-sm" 
                      : "text-slate-700 hover:bg-riverBlue/10 hover:text-riverBlue"
                    }
                  `}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
