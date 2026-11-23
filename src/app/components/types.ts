import type { FadeParams } from '../../core/index';

/** Props every settings section receives. `live` changes (slider drags) wait for `onCommit` to enter history. */
export interface SectionProps {
  params: FadeParams;
  onChange: (next: FadeParams, live?: boolean) => void;
  onCommit: () => void;
}
