import React, { useState, useEffect, useRef } from 'react';

export default function CustomDropdown({ value, onChange, options, placeholder, btnClassName = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || null;

  return (
    <div className="relative custom-dropdown" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white border border-sandBeige/50 text-left rounded-xl px-2.5 py-2.5 md:px-3.5 md:py-3 text-xs md:text-sm flex justify-between items-center focus:ring-2 focus:ring-riverBlue/30 outline-none shadow-sm ${btnClassName}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="val-icon flex-shrink-0">{selectedOption.icon}</span>}
              <span className="val-text truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </span>
        <span className="material-icons-outlined text-[14px] text-slate-400 flex items-center justify-center flex-shrink-0">
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sandBeige rounded-xl shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="px-3 py-2.5 text-xs hover:bg-sandBeige/20 cursor-pointer flex justify-between items-center gap-2"
            >
              <span className="flex items-center gap-1.5 min-w-0 truncate">
                {option.icon && <span className="val-icon flex-shrink-0">{option.icon}</span>}
                <span className="val-text truncate">{option.label}</span>
              </span>
              {option.rightText && (
                <span className="text-[10px] text-slate-400 flex-shrink-0">{option.rightText}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
