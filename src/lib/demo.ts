// Demo accounts created by `npm run seed:demo`. Emails use the reserved example.com domain.
export const DEMO_ACCOUNTS = [
  { key: 'owner', email: 'owner.demo@example.com', name: 'Neetu Thakkilapati', label: 'Owner', blurb: 'Sees both schools, billing, AI assistant' },
  { key: 'director', email: 'director.demo@example.com', name: 'Rachel Gomes', label: 'Director', blurb: 'Runs Bright Star Children’s Montessori' },
  { key: 'teacher', email: 'teacher.demo@example.com', name: 'Theo Nguyen', label: 'Teacher', blurb: 'Infant room: check-ins, care log, photos' },
  { key: 'parent', email: 'parent.demo@example.com', name: 'Priya Shah', label: 'Parent', blurb: 'Daily report, messages, bills, video' },
  { key: 'grandparent', email: 'grandpa.demo@example.com', name: 'Ravi Shah', label: 'Grandparent', blurb: 'Video-only sub-user' },
] as const;
export type DemoKey = (typeof DEMO_ACCOUNTS)[number]['key'];
