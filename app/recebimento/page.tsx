"use client";

import { useState } from "react";

export default function Recebimento() {
  const [produto, setProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");

  function handleSubmit(e: any) {
    e.preventDefault();

    console.log({
      produto,
      quantidade
    });

    alert("Recebido (simulação)");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Recebimento de Mercadoria</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Produto:</label><br />
          <input
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
          />
        </div>

        <div>
          <label>Quantidade:</label><br />
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <br />
        <button type="submit">Receber</button>
      </form>
    </div>
  );
}