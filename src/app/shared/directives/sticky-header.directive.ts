import { Directive, ElementRef, inject, Renderer2, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: '[appStickyHeader]',
  standalone: true
})
export class StickyHeaderDirective implements OnInit, OnDestroy {
  private observer: IntersectionObserver | undefined;

  // Создаем невидимый "сенсорный" элемент, чтобы отслеживать положение хедера
  private sentinel: HTMLElement;

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  ngOnInit(): void {
    // Создаем "сенсор" и помещаем его ПЕРЕД хедером
    this.sentinel = this.renderer.createElement('div');
    this.renderer.addClass(this.sentinel, 'sticky-sentinel');
    this.renderer.insertBefore(this.el.nativeElement.parentNode, this.sentinel, this.el.nativeElement);

    // IntersectionObserver - это современный API браузера для отслеживания видимости элементов
    this.observer = new IntersectionObserver(([entry]) => {
      // entry.isIntersecting будет true, когда "сенсор" виден, и false, когда он скрыт за "прилипшим" хедером
      if (!entry.isIntersecting) {
        this.renderer.addClass(this.el.nativeElement, 'is-sticky');
      } else {
        this.renderer.removeClass(this.el.nativeElement, 'is-sticky');
      }
    }, {
      // Порог срабатывания. 1.0 означает, что событие сработает, как только элемент полностью исчезнет или появится.
      threshold: [1]
    });

    // Начинаем наблюдение за "сенсором"
    this.observer.observe(this.sentinel);
  }

  ngOnDestroy(): void {
    // Очищаем ресурсы при уничтожении директивы
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.sentinel && this.sentinel.parentNode) {
      this.renderer.removeChild(this.sentinel.parentNode, this.sentinel);
    }
  }
}
