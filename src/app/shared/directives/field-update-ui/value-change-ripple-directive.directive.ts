import {
  Directive,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  Renderer2,
  SimpleChanges,
  OnChanges,
} from '@angular/core';

@Directive({
  selector: '[appValueChangeRipple]',
  standalone: true,
})
export class ValueChangeRippleDirective implements OnChanges, OnDestroy {
  @Input('appValueChangeRipple') value: any;

  private elementRef = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private static styleElement: HTMLStyleElement | null = null;
  private unlistenAnimationEndFn: (() => void) | null = null;
  private readonly RIPPLE_CLASS = 'value-change-ripple-effect';

  constructor() {
    this.ensureStylesInjected();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const { previousValue, currentValue, firstChange } = changes['value'];
      if (firstChange) {
        return;
      }
      if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
        this.triggerAnimation();
      }
    }
  }

  private triggerAnimation(): void {
    const element = this.elementRef.nativeElement;
    if (element.classList.contains(this.RIPPLE_CLASS)) {
      return;
    }
    this.renderer.addClass(element, this.RIPPLE_CLASS);
    this.unlistenAnimationEndFn = this.renderer.listen(
      element,
      'animationend',
      () => {

      }
    );
  }


  private ensureStylesInjected(): void {
    if (ValueChangeRippleDirective.styleElement) {
      return;
    }

    const css = `
      @keyframes value-change-ripple-animation {
        from {
          box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
        }
        to {
          box-shadow: 0 0 0 20px rgba(22, 163, 74, 0);
        }
      }

      .${this.RIPPLE_CLASS} {
        position: relative;
        animation: value-change-ripple-animation 1s ease-out;
      }
    `;

    const style = this.renderer.createElement('style');
    this.renderer.appendChild(style, this.renderer.createText(css));
    this.renderer.appendChild(document.head, style);

    ValueChangeRippleDirective.styleElement = style;
  }

  ngOnDestroy(): void {
    if (this.unlistenAnimationEndFn) {
      this.unlistenAnimationEndFn();
    }
  }
}
