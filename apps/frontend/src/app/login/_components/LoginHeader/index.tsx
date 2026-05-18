import {cookies} from "next/headers";
import {ThemeSwitch} from "@/components/ThemeSwitch";
import {ThemeE} from "@/types/common";
import styles from './styles.module.scss'

export const LoginHeader = async () => {
    const cookieStore = await cookies()
    const theme = (cookieStore.get('theme')?.value || ThemeE.light) as ThemeE;

    return <header className={styles.loginHeader}>
        <h3>Vocab Bloom Logo</h3>
        <ThemeSwitch theme={theme}/>
    </header>
}