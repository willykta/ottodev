import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';
import { ClipboardAddon } from '@xterm/addon-clipboard';

const clipboardAddon = new ClipboardAddon();
const logger = createScopedLogger('Terminal');

export interface TerminalRef {
  reloadStyles: () => void;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  id: string;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, theme, readonly, id, onTerminalReady, onTerminalResize }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<XTerm>();

      useEffect(() => {
        const element = terminalElementRef.current!;
        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        const terminal = new XTerm({
          cursorBlink: true,
          convertEol: true,
          disableStdin: readonly,
          theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
          fontSize: 12,
          fontFamily: 'Menlo, courier-new, courier, monospace',
        });

        terminalRef.current = terminal;

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.loadAddon(clipboardAddon); // Add clipboard support
        terminal.open(element);

        // Add event listener for Ctrl+C and Ctrl+V
        terminal.onKey(({ domEvent }) => {
          const isCtrl = domEvent.ctrlKey || domEvent.metaKey; // Support Cmd on macOS

          if (isCtrl && domEvent.code === 'KeyC') {
            const selection = terminal.getSelection();
            if (selection) {
              navigator.clipboard
                .writeText(selection)
                .then(() => logger.debug('Copied to clipboard:', selection))
                .catch((err) => console.error('Copy failed:', err));
            }
            domEvent.preventDefault();
          }

          if (isCtrl && domEvent.code === 'KeyV') {
            navigator.clipboard
              .readText()
              .then((text) => {
                terminal.paste(text);
                logger.debug('Pasted from clipboard:', text);
              })
              .catch((err) => console.error('Paste failed:', err));
            domEvent.preventDefault();
          }
        });

        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          onTerminalResize?.(terminal.cols, terminal.rows);
        });

        resizeObserver.observe(element);

        logger.debug(`Attach [${id}]`);

        onTerminalReady?.(terminal);

        return () => {
          resizeObserver.disconnect();
          terminal.dispose();
        };
      }, []);

      useEffect(() => {
        const terminal = terminalRef.current!;

        // Update terminal theme and readonly state
        terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
        terminal.options.disableStdin = readonly;
      }, [theme, readonly]);

      useImperativeHandle(ref, () => {
        return {
          reloadStyles: () => {
            const terminal = terminalRef.current!;
            terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          },
        };
      }, []);

      return <div className={className} ref={terminalElementRef} />;
    },
  ),
);
