import { useRef, useState } from 'react';

export default function TagChipInput({ value = [], onChange, placeholder, ariaLabel, maxTags = 20, prefix }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  function addTag(raw) {
    const clean = String(raw || '').trim().replace(/^[#@]/, '').replace(/\s+/g, ' ');
    if (!clean) return;
    if (value.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    if (value.length >= maxTags) return;
    onChange?.([...value, clean]);
  }

  function removeAt(i) {
    onChange?.(value.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (text.trim()) {
        addTag(text);
        setText('');
      }
    } else if (e.key === 'Backspace' && !text && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    } else if (e.key === 'Escape') {
      setText('');
    }
  }

  function onPaste(e) {
    const pasted = e.clipboardData?.getData('text') || '';
    if (!pasted.includes(',') && !pasted.includes('\n')) return;
    e.preventDefault();
    pasted.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).forEach(addTag);
    setText('');
  }

  return (
    <div className="tag-chip-input" onClick={() => inputRef.current?.focus()}>
      {value.map((tag, i) => (
        <span key={`${tag}-${i}`} className="tag-chip">
          {prefix}{tag}
          <button
            type="button"
            className="tag-chip-remove"
            onClick={(e) => { e.stopPropagation(); removeAt(i); }}
            aria-label={`Remove ${tag}`}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="tag-chip-field"
        value={text}
        placeholder={value.length === 0 ? placeholder : ''}
        aria-label={ariaLabel || placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => { if (text.trim()) { addTag(text); setText(''); } }}
      />
    </div>
  );
}
