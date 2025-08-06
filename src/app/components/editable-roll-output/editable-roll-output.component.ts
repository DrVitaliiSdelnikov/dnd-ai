import { Component, computed, EventEmitter, Input, Output, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-editable-roll-output',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editable-roll-output.component.html',
  styleUrls: ['./editable-roll-output.component.scss']
})
export class EditableRollOutputComponent {
  @Input() initialString: string = '';
  @Output() finalString = new EventEmitter<string>();

  editableContent = signal('');

  parsedOutput = computed(() => {
    return this.editableContent();
  });

  constructor() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialString']) {
      this.editableContent.set(changes['initialString'].currentValue);
    }
  }

  onContentChange(event: any) {
    this.editableContent.set(event.target.innerText);
  }

  emitFinalString() {
    this.finalString.emit(this.parsedOutput());
  }
} 