import { Directive, ElementRef, HostListener, OnDestroy, Renderer2, inject } from '@angular/core';
import { AppStateService } from '../application-runner/state/app-state.service';

/**
 * Drop onto any `<input>` or `<textarea>` to get a "$" autocomplete for
 * global variables — used both for plain text properties (e.g. a Button's
 * `label`) and for JSON property/style fields, so the behavior (and the
 * caret-anchored dropdown positioning) only has to be built once.
 *
 * Typing `$foo` opens a dropdown of matching variable names right under
 * the caret (computed via the "mirror div" technique, not just anchored
 * to the field's bottom edge, which breaks down for multi-line text).
 * Selecting one replaces the partial `$foo` with `$name` and fires a
 * native `input` event, so the host's own `(input)`/`(ngModelChange)`/
 * `(change)` bindings see the change exactly as if the user had typed it.
 */
@Directive({
  selector: '[elvVariableAutocomplete]',
  standalone: true,
})
export class ElvVariableAutocompleteDirective implements OnDestroy {
  private readonly appState = inject(AppStateService);
  private readonly renderer = inject(Renderer2);
  private readonly host = inject(ElementRef<HTMLInputElement | HTMLTextAreaElement>).nativeElement;

  private dropdown: HTMLElement | null = null;
  private matches: string[] = [];
  private activeIndex = 0;
  private closeTimeout?: ReturnType<typeof setTimeout>;

  @HostListener('input')
  onInput(): void {
    const query = this.currentQuery();
    if (query === null) {
      this.close();
      return;
    }
    this.matches = this.appState
      .variableNames()
      .filter((name) => name.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')))
      .slice(0, 8);
    if (!this.matches.length) {
      this.close();
      return;
    }
    this.activeIndex = 0;
    this.render();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.dropdown) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.matches.length;
      this.render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + this.matches.length) % this.matches.length;
      this.render();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.insert(this.matches[this.activeIndex]);
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  @HostListener('blur')
  onBlur(): void {
    // Deferred so a click on a dropdown option still lands before we tear it down.
    this.closeTimeout = setTimeout(() => this.close(), 150);
  }

  ngOnDestroy(): void {
    this.close();
  }

  /** The `$partial` text run up to the caret, or `null` when the caret isn't inside one. */
  private currentQuery(): string | null {
    const value = this.host.value;
    const cursor = this.host.selectionStart ?? value.length;
    const match = /\$([\w-]*)$/.exec(value.slice(0, cursor));
    return match ? match[1] : null;
  }

  private insert(name: string): void {
    const value = this.host.value;
    const cursor = this.host.selectionStart ?? value.length;
    const before = value.slice(0, cursor).replace(/\$([\w-]*)$/, `$${name}`);
    const after = value.slice(cursor);
    const updated = before + after;

    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.host), 'value')?.set;
    setter?.call(this.host, updated);
    const newCursor = before.length;
    this.host.setSelectionRange(newCursor, newCursor);
    this.host.dispatchEvent(new Event('input', { bubbles: true }));
    // Hosts commit on `change` (e.g. `updateProperty`, bound via `(change)`
    // rather than `(input)`) — fire both so a picked suggestion persists
    // immediately instead of waiting for a blur the user may not trigger.
    this.host.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
    this.host.focus();
  }

  private render(): void {
    if (!this.dropdown) {
      this.dropdown = this.renderer.createElement('div') as HTMLElement;
      this.renderer.setAttribute(this.dropdown, 'data-elv-variable-autocomplete', '');
      Object.assign(this.dropdown.style, {
        position: 'fixed',
        zIndex: '9999',
        minWidth: '10rem',
        maxHeight: '12rem',
        overflowY: 'auto',
        borderRadius: '0.5rem',
        border: '1px solid rgb(226 232 240)',
        backgroundColor: '#fff',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        fontSize: '10px',
      } satisfies Partial<CSSStyleDeclaration>);
      document.body.appendChild(this.dropdown);
    }

    this.dropdown.innerHTML = '';
    this.matches.forEach((name, index) => {
      const option = this.renderer.createElement('button') as HTMLButtonElement;
      option.type = 'button';
      option.textContent = `$${name}`;
      Object.assign(option.style, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '0.375rem 0.625rem',
        color: index === this.activeIndex ? '#4338ca' : '#334155',
        backgroundColor: index === this.activeIndex ? '#eef2ff' : 'transparent',
        cursor: 'pointer',
      } satisfies Partial<CSSStyleDeclaration>);
      // mousedown (not click) fires before the host's blur handler closes the dropdown.
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        this.insert(name);
      });
      this.dropdown?.appendChild(option);
    });

    this.position();
  }

  private position(): void {
    if (!this.dropdown) return;
    const caret = this.caretCoordinates();
    const hostRect = this.host.getBoundingClientRect();
    this.dropdown.style.left = `${Math.round(caret.x)}px`;
    this.dropdown.style.top = `${Math.round(caret.y)}px`;
    this.dropdown.style.maxWidth = `${Math.round(Math.max(160, hostRect.right - caret.x))}px`;
  }

  private close(): void {
    clearTimeout(this.closeTimeout);
    this.dropdown?.remove();
    this.dropdown = null;
    this.matches = [];
  }

  /**
   * Viewport coordinates of the text caret, just below its line — the
   * "mirror div" technique: an off-screen clone of the field, styled
   * identically, with its text replaced up to the caret so the browser's
   * own line-wrapping tells us exactly where the caret would land.
   */
  private caretCoordinates(): { x: number; y: number } {
    const host = this.host;
    const cursor = host.selectionStart ?? host.value.length;
    const computed = getComputedStyle(host);
    const mirror = document.createElement('div');
    const isTextarea = host.tagName === 'TEXTAREA';

    const propertiesToCopy = [
      'boxSizing', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'textTransform',
    ] as const;
    for (const prop of propertiesToCopy) {
      mirror.style[prop as unknown as number] = computed[prop as keyof CSSStyleDeclaration] as string;
    }
    Object.assign(mirror.style, {
      position: 'absolute',
      visibility: 'hidden',
      top: '0',
      left: '-9999px',
      whiteSpace: isTextarea ? 'pre-wrap' : 'pre',
      wordWrap: 'break-word',
      overflow: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>);

    const before = host.value.slice(0, cursor);
    mirror.textContent = before;
    const marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const offsetX = markerRect.left - mirrorRect.left;
    const offsetY = markerRect.top - mirrorRect.top;
    mirror.remove();

    const lineHeight = parseFloat(computed.lineHeight) || markerRect.height || 16;
    return {
      x: hostRect.left + offsetX - host.scrollLeft,
      y: hostRect.top + offsetY + lineHeight - host.scrollTop,
    };
  }
}
