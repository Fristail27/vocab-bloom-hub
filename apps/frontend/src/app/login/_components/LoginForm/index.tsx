'use client'

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {InputText} from "primereact/inputtext";
import {Button} from "primereact/button";
import {AuthApi} from "@/core/api/AuthApi";
import {hashLoginString} from '../../../../../../server/core/utils/crypto'
import styles from "./styles.module.scss";

export const LoginForm = () => {
    const [username, setUsername] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const submitLogin = async () => {
        const hash = await hashLoginString(username, pass)
        const res = await AuthApi.login({hash});

        if ('error' in res) {
            setError(res.message);
        } else {
            router.push('/');
        }
    }

    useEffect(() => {setError(null)}, [pass, username]);

    return <div className={styles.card}>
        <h1>Vocab Bloom</h1>
        <h2>Admin panel</h2>
        <InputText
            value={username}
            onChange={e => setUsername(e.target.value)}
            id="username"
            name="username"
            invalid={!!error}
            placeholder="Username"
        />
        <InputText
            value={pass}
            onChange={e => setPass(e.target.value)}
            id="password"
            name="password"
            invalid={!!error}
            placeholder="Password"
        />
        {error && <span className={styles.error}>{error}</span>}
        <Button disabled={!!error} onClick={submitLogin} label="Submit" />
    </div>
}