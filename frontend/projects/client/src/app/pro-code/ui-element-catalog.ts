export type UiElementIcon =
  | 'button'
  | 'card'
  | 'field'
  | 'choice'
  | 'feedback'
  | 'profile'
  | 'navigation'
  | 'layout';

export interface UiElementDefinition {
  name: string;
  title: string;
  description: string;
  icon: UiElementIcon;
}

export const UI_ELEMENT_CATALOG: readonly UiElementDefinition[] = [
  { name: 'button', title: 'Button', description: 'Aktion und Formular', icon: 'button' },
  { name: 'card', title: 'Card', description: 'Inhaltscontainer', icon: 'card' },
  { name: 'text-input', title: 'Text Input', description: 'Einzeilige Eingabe', icon: 'field' },
  { name: 'textarea', title: 'Textarea', description: 'Mehrzeilige Eingabe', icon: 'field' },
  { name: 'checkbox', title: 'Checkbox', description: 'Mehrfachauswahl', icon: 'choice' },
  { name: 'select', title: 'Select', description: 'Auswahlliste', icon: 'choice' },
  { name: 'toggle', title: 'Toggle', description: 'Ein- oder ausschalten', icon: 'choice' },
  { name: 'slider', title: 'Slider', description: 'Wert einstellen', icon: 'choice' },
  { name: 'badge', title: 'Badge', description: 'Status oder Kategorie', icon: 'feedback' },
  { name: 'alert', title: 'Alert', description: 'Hinweis und Meldung', icon: 'feedback' },
  { name: 'avatar', title: 'Avatar', description: 'Person oder Profilbild', icon: 'profile' },
  { name: 'spinner', title: 'Spinner', description: 'Ladeindikator', icon: 'feedback' },
  { name: 'progress', title: 'Progress', description: 'Fortschrittsanzeige', icon: 'feedback' },
  { name: 'tooltip', title: 'Tooltip', description: 'Kontexthinweis', icon: 'feedback' },
  { name: 'modal', title: 'Modal', description: 'Dialogfenster', icon: 'layout' },
  { name: 'tabs', title: 'Tabs', description: 'Registerkarten', icon: 'navigation' },
  { name: 'accordion', title: 'Accordion', description: 'Ein-/ausklappbarer Inhalt', icon: 'navigation' },
  { name: 'dropdown', title: 'Dropdown', description: 'Kontextmenü', icon: 'navigation' },
  { name: 'pagination', title: 'Pagination', description: 'Seitennavigation', icon: 'navigation' },
  { name: 'divider', title: 'Divider', description: 'Inhaltsabstand', icon: 'layout' },
  { name: 'skeleton', title: 'Skeleton', description: 'Ladeplatzhalter', icon: 'layout' },
  { name: 'form-field', title: 'Form Field', description: 'Beschriftung und Validierung', icon: 'field' },
];
