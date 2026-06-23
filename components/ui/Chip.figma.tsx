import figma from '@figma/code-connect';
import { Chip } from './Chip';
figma.connect(Chip, 'https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System?node-id=6-22', {
  variant: { State: 'Selected' },
  props: { label: figma.string('Label') },
  example: ({ label }) => <Chip selected>{label}</Chip>,
});
figma.connect(Chip, 'https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System?node-id=6-22', {
  variant: { State: 'Default' },
  props: { label: figma.string('Label') },
  example: ({ label }) => <Chip>{label}</Chip>,
});
