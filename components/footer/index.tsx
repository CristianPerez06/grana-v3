import { LanguageSwitcher } from './language-switcher'

export const Footer = () => (
  <footer className="flex justify-center items-center gap-3 py-4 border-t border-border text-sm text-muted-foreground">
    <LanguageSwitcher />
  </footer>
)
