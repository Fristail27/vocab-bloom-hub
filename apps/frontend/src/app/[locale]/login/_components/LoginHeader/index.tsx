import {cookies} from "next/headers";
import {ThemeSwitch} from "@/components/ThemeSwitch";
import {ThemeE} from "@/types/common";
import {MainLogoWithTitle} from "@/core/ui/logo";
import {LanguageSwitch} from "@/components/LanguageSwitch";
import styles from './styles.module.scss'

export const LoginHeader = async () => {
    const cookieStore = await cookies()
    const theme = (cookieStore.get('theme')?.value || ThemeE.light) as ThemeE;

    return <header className={styles.loginHeader}>
        <MainLogoWithTitle width={336} height={72}/>
        <LanguageSwitch />
        <ThemeSwitch theme={theme}/>
    </header>
}