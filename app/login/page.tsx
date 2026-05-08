"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function handleLogin(e: any) {
    e.preventDefault();

    // LOGIN SIMPLES (provisório)
    if (email === "admin@wms.com" && senha === "123") {
      router.push("/dashboard");
    } else {
      alert("Login inválido");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Login WMS</h1>

      <form onSubmit={handleLogin}>
        <div>
          <label>Email:</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label>Senha:</label><br />
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <br />
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}