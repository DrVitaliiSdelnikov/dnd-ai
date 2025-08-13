import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environment/environment';

// Suppress noisy dev-only logs/warnings
if (!environment.production) {
  const originalWarn = console.warn.bind(console);
  const originalLog = console.log.bind(console);
  const noisyWarnPatterns = [
    /AccordionTab is deprecated/i,
    /OverlayPanel is deprecated/i,
    /Dropdown component is deprecated/i
  ];
  const noisyLogPatterns = [
    /Angular is running in development mode\./i
  ];
  console.warn = (...args: any[]) => {
    const text = args.join(' ');
    if (noisyWarnPatterns.some(r => r.test(text))) { return; }
    originalWarn(...args);
  };
  console.log = (...args: any[]) => {
    const text = args.join(' ');
    if (noisyLogPatterns.some(r => r.test(text))) { return; }
    originalLog(...args);
  };
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
