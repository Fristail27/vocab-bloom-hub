import en from '../messages/en';
import ru from '../messages/ru';
import de from '../messages/de';
import es from '../messages/es';
import fr from '../messages/fr';
import pt from '../messages/pt';
import ar from '../messages/ar';
import zh from '../messages/zh';

export const catalogs = { en, ru, de, es, fr, pt, ar, zh };
export const messagesFor = (globals: Record<string, unknown>) =>
  catalogs[(globals.locale ?? 'en') as keyof typeof catalogs];
