import { TextareaHTMLAttributes, forwardRef } from 'react';
import './TranslationArea.css';

interface TranslationAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const TranslationArea = forwardRef<HTMLTextAreaElement, TranslationAreaProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className={`translation-area ${className}`}>
        {label && <span className="area-label">{label}</span>}
        <textarea ref={ref} className="area-textarea" {...props} />
      </div>
    );
  }
);

TranslationArea.displayName = 'TranslationArea';