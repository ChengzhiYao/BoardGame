import figma from '@figma/code-connect';
import { Card } from './Card';
figma.connect(Card, 'https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System?node-id=7-8', {
  props: { title: figma.string('title'), body: figma.string('body') },
  example: ({ title, body }) => (
    <Card>
      <div className="font-serif text-text-primary">{title}</div>
      <div className="text-sm text-text-secondary">{body}</div>
    </Card>
  ),
});
