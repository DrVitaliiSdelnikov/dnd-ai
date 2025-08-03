import { Directive, ElementRef, inject, Renderer2, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[appStickyHeader]',
  standalone: true
})
export class StickyHeaderDirective implements OnInit, OnDestroy {
  private observer: IntersectionObserver | undefined;
  private sentinel: HTMLElement;

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  ngOnInit(): void {
    this.sentinel = this.renderer.createElement('div');
    this.renderer.addClass(this.sentinel, 'sticky-sentinel');
    this.renderer.insertBefore(this.el.nativeElement.parentNode, this.sentinel, this.el.nativeElement);

    this.observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        this.renderer.addClass(this.el.nativeElement, 'is-sticky');
      } else {
        this.renderer.removeClass(this.el.nativeElement, 'is-sticky');
      }
    }, {
      threshold: [1]
    });
    this.observer.observe(this.sentinel);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.sentinel && this.sentinel.parentNode) {
      this.renderer.removeChild(this.sentinel.parentNode, this.sentinel);
    }
  }
}
