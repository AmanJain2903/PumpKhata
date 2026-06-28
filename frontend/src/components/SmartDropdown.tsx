import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional: accent color dot shown beside the label */
  accent?: string;
  /** Optional: make this option visually distinct (e.g. "+ Add New") */
  isAction?: boolean;
}

interface SmartDropdownProps {
  /** Currently selected value */
  value: string;
  /** Callback when a value is selected */
  onChange: (value: string) => void;
  /** List of options */
  options: DropdownOption[];
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Additional className for the trigger button */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export const SmartDropdown: React.FC<SmartDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    direction: 'below' | 'above';
  }>({ left: 0, width: 0, maxHeight: 220, direction: 'below' });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  // Calculate fixed position relative to viewport
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const PADDING = 8;
    const GAP = 4; // gap between trigger and dropdown

    const spaceBelow = viewportHeight - rect.bottom - PADDING;
    const spaceAbove = rect.top - PADDING;

    // Open in direction with more space
    if (spaceAbove > spaceBelow) {
      setPosition({
        bottom: viewportHeight - rect.top + GAP,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(spaceAbove, 260),
        direction: 'above',
      });
    } else {
      setPosition({
        top: rect.bottom + GAP,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(spaceBelow, 260),
        direction: 'below',
      });
    }
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(prev => !prev);
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  // Recalculate position after opening (dropdown is now rendered)
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Recalculate & close on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const recalc = () => calculatePosition();
    // Close on scroll (since the trigger moves with scroll, dropdown would desync)
    const handleScroll = () => setIsOpen(false);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', recalc);
    };
  }, [isOpen, calculatePosition]);

  // The dropdown menu rendered via portal
  const dropdownMenu = isOpen
    ? ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          onTouchMove={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: position.top != null ? `${position.top}px` : undefined,
            bottom: position.bottom != null ? `${position.bottom}px` : undefined,
            left: `${position.left}px`,
            width: `${position.width}px`,
            maxHeight: `${position.maxHeight}px`,
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            zIndex: 99999,
          }}
          className={`
            bg-white border border-slate-200 rounded-xl
            shadow-lg shadow-slate-200/60
            overflow-y-auto overscroll-contain
          `}
        >
          <div className="py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full text-left px-3 py-2.5 text-xs
                    flex items-center gap-2
                    transition-colors duration-100
                    ${option.isAction
                      ? 'text-emerald-600 font-bold hover:bg-emerald-50 border-t border-slate-100'
                      : isSelected
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  {option.accent && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: option.accent }}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                  {isSelected && !option.isAction && (
                    <svg className="w-3.5 h-3.5 text-emerald-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          bg-white border border-slate-200 rounded-xl
          px-3 py-2.5 text-xs text-left
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-slate-300 hover:shadow-sm'}
          ${isOpen ? 'border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm' : ''}
          ${className}
        `}
      >
        <span className={`truncate ${selectedOption ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownMenu}
    </div>
  );
};
