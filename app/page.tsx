"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    html2pdf?: any;
  }
}

type CurvaABC = "A" | "B" | "C";
type PerfilUsuario = "Administrador" | "Usuário";
type StatusEndereco = "Livre" | "Picking" | "Bloqueado" | "Ocupado";
type TipoMovimento =
  | "Entrada"
  | "Saída"
  | "Inventário"
  | "Transferência"
  | "Ajuste"
  | "Divergência";
type ModoInventario = "endereco" | "produto";
type TipoRelatorio = "produto" | "geral";
type AbaSistema =
  | "dashboard"
  | "cadastros"
  | "entrada"
  | "saida"
  | "movimentacoes"
  | "inventario"
  | "relatorios"
  | "perfil";

type Produto = {
  id: number;
  nome: string;
  linha: string;
  tipo: string;
  ml: string;
  curva: CurvaABC;
  qtdPorCaixa: number;
  qtdMaxPallet: number;
  codigoBarras: string;
};

type Endereco = {
  id: number;
  codigo: string;
  rua: string;
  predio: string;
  nivel: string;
  status: StatusEndereco;
};

type Usuario = {
  id: number;
  nome: string;
  login: string;
  senha: string;
  perfil: PerfilUsuario;
  status: "Ativo" | "Inativo";
};

type Estoque = {
  id: number;
  produtoId: number;
  endereco: string;
  quantidade: number;
};

type Movimento = {
  id: number;
  data: string;
  tipo: TipoMovimento;
  produtoId: number;
  quantidade: number;
  endereco: string;
  enderecoDestino?: string;
  usuario: string;
  observacao?: string;
};

type LogAdmin = {
  id: number;
  data: string;
  usuario: string;
  tipo: string;
  detalhe: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  text: string;
  onConfirm: null | (() => void);
};

type ToastState = {
  open: boolean;
  type: "success" | "error" | "info";
  text: string;
};

const STORAGE_KEYS = {
  usuarios: "wms_vmd_usuarios",
  produtos: "wms_vmd_produtos",
  enderecos: "wms_vmd_enderecos",
  estoque: "wms_vmd_estoque",
  movimentos: "wms_vmd_movimentos",
  logsAdmin: "wms_vmd_logs_admin",
};

const produtosSeed: Produto[] = [
  {
    id: 1,
    nome: "IMPRESSO A4",
    linha: "Impressos",
    tipo: "Branco",
    ml: "180",
    curva: "A",
    qtdPorCaixa: 1000,
    qtdMaxPallet: 36,
    codigoBarras: "789000000001",
  },
  {
    id: 2,
    nome: "IMPRESSO ETIQUETA",
    linha: "Impressos",
    tipo: "Branco",
    ml: "200",
    curva: "A",
    qtdPorCaixa: 1800,
    qtdMaxPallet: 40,
    codigoBarras: "789000000004",
  },
  {
    id: 3,
    nome: "IMPRESSO ETIQUETA",
    linha: "Impressos",
    tipo: "Branco",
    ml: "240",
    curva: "B",
    qtdPorCaixa: 2000,
    qtdMaxPallet: 42,
    codigoBarras: "789000000002",
  },
  {
    id: 4,
    nome: "IMPRESSO FILME",
    linha: "Impressos",
    tipo: "Transparente",
    ml: "300",
    curva: "C",
    qtdPorCaixa: 2500,
    qtdMaxPallet: 30,
    codigoBarras: "789000000003",
  },
];

const usuariosSeed: Usuario[] = [
  {
    id: 1,
    nome: "MARLON",
    login: "MARLON",
    senha: "1234",
    perfil: "Administrador",
    status: "Ativo",
  },
  {
    id: 2,
    nome: "USER01",
    login: "USER01",
    senha: "1234",
    perfil: "Usuário",
    status: "Ativo",
  },
];

function gerarEnderecosBase(): Endereco[] {
  const ruas = ["A", "B", "C"];
  const niveis = ["A", "B", "C", "D", "E"];
  const totalPredios = 210;
  const lista: Endereco[] = [];
  let id = 1;

  for (const rua of ruas) {
    for (let predio = 1; predio <= totalPredios; predio++) {
      for (const nivel of niveis) {
        const codigo = `${rua}${String(predio).padStart(3, "0")}${nivel}`;
        let status: StatusEndereco = "Livre";
        if (rua === "B" && nivel === "A") status = "Picking";
        if (predio % 17 === 0 && nivel === "E") status = "Bloqueado";

        lista.push({
          id: id++,
          codigo,
          rua: `Rua ${rua}`,
          predio: String(predio).padStart(3, "0"),
          nivel,
          status,
        });
      }
    }
  }

  return lista;
}

const enderecosSeed: Endereco[] = gerarEnderecosBase();
const estoqueSeed: Estoque[] = [];
const movimentosSeed: Movimento[] = [];

const confirmInicial: ConfirmState = {
  open: false,
  title: "",
  text: "",
  onConfirm: null,
};

const toastInicial: ToastState = {
  open: false,
  type: "info",
  text: "",
};

function lerStorage<T>(chave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : fallback;
  } catch {
    return fallback;
  }
}

function salvarStorage<T>(chave: string, valor: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
}

function dataAgora() {
  return new Date().toLocaleString("pt-BR");
}

function siglaRua(rua: string) {
  if (rua === "Rua A") return "A";
  if (rua === "Rua B") return "B";
  return "C";
}

function montarCodigoEndereco(rua: string, predio: string, nivel: string) {
  return `${siglaRua(rua)}${predio.padStart(3, "0")}${nivel}`.toUpperCase();
}

function extrairPredio(codigo: string) {
  const numeros = codigo.match(/\d+/);
  return numeros ? Number(numeros[0]) : 999;
}

function distanciaDoCentro(codigo: string) {
  return Math.abs(extrairPredio(codigo) - 32);
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#14213d",
    fontFamily: "Arial, sans-serif",
  },
  loginWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(135deg, #e8f1ff 0%, #f8fbff 100%)",
  },
  loginCard: {
    width: "100%",
    maxWidth: 430,
    background: "#ffffff",
    borderRadius: 18,
    padding: 28,
    boxShadow: "0 12px 35px rgba(20,33,61,0.12)",
    border: "1px solid #d8e2f0",
  },
  appShell: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    minHeight: "100vh",
  },
  sidebar: {
    background: "#14213d",
    color: "#ffffff",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  content: {
    padding: 20,
    overflowX: "auto",
  },
  brand: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  navButton: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
    fontWeight: 700,
  },
  navButtonActive: {
    background: "#fca311",
    color: "#14213d",
    border: "1px solid #fca311",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    border: "1px solid #dbe4f0",
    boxShadow: "0 8px 22px rgba(20,33,61,0.06)",
  },
  cardTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: 800,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#3b4b68",
  },
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #cfd9e6",
    padding: "11px 12px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #cfd9e6",
    padding: "11px 12px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #cfd9e6",
    padding: "11px 12px",
    fontSize: 14,
    minHeight: 90,
    outline: "none",
    background: "#fff",
  },
  buttonPrimary: {
    background: "#fca311",
    color: "#14213d",
    border: "none",
    borderRadius: 10,
    padding: "12px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  buttonSecondary: {
    background: "#e9eef6",
    color: "#14213d",
    border: "1px solid #cfd9e6",
    borderRadius: 10,
    padding: "12px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonDanger: {
    background: "#c62828",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eef4ff",
    color: "#21406f",
    fontSize: 12,
    fontWeight: 800,
  },
  metric: {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    border: "1px solid #dbe4f0",
    boxShadow: "0 8px 22px rgba(20,33,61,0.06)",
  },
  metricNumber: {
    marginTop: 6,
    fontWeight: 900,
    fontSize: 28,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #dbe4f0",
    borderRadius: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },
  th: {
    background: "#eff4fb",
    color: "#21324f",
    textAlign: "left",
    padding: 12,
    fontSize: 13,
    borderBottom: "1px solid #dbe4f0",
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #edf2f7",
    fontSize: 14,
    verticalAlign: "top",
  },
  sectionGap: {
    display: "grid",
    gap: 16,
  },
  smallMuted: {
    color: "#5d6d89",
    fontSize: 13,
  },
  lineActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  toast: {
    position: "fixed",
    right: 20,
    bottom: 20,
    padding: "12px 16px",
    borderRadius: 12,
    color: "#fff",
    fontWeight: 800,
    zIndex: 9999,
    boxShadow: "0 10px 25px rgba(0,0,0,0.16)",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(20,33,61,0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 9998,
  },
  modal: {
    width: "100%",
    maxWidth: 480,
    background: "#fff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
  },
};

export default function Page() {
  const [carregado, setCarregado] = useState(false);
  const [aba, setAba] = useState<AbaSistema>("dashboard");

  const [produtos, setProdutos] = useState<Produto[]>(produtosSeed);
  const [enderecos, setEnderecos] = useState<Endereco[]>(enderecosSeed);
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosSeed);
  const [estoque, setEstoque] = useState<Estoque[]>(estoqueSeed);
  const [movimentos, setMovimentos] = useState<Movimento[]>(movimentosSeed);
  const [logsAdmin, setLogsAdmin] = useState<LogAdmin[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(confirmInicial);
  const [toast, setToast] = useState<ToastState>(toastInicial);
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(null);
  const [mensagemPerfil, setMensagemPerfil] = useState("");

  const [loginForm, setLoginForm] = useState({ login: "", senha: "" });

  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    linha: "Impressos",
    tipo: "Branco",
    ml: "",
    curva: "A" as CurvaABC,
    qtdPorCaixa: "",
    qtdMaxPallet: "",
    codigoBarras: "",
  });

  const [novoEndereco, setNovoEndereco] = useState({
    rua: "Rua C",
    predio: "",
    nivel: "A",
    status: "Livre" as StatusEndereco,
  });

  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    login: "",
    senha: "",
    perfil: "Usuário" as PerfilUsuario,
    status: "Ativo" as Usuario["status"],
  });

  const [trocaSenha, setTrocaSenha] = useState({
    atual: "",
    nova: "",
    confirmar: "",
  });

  const [entrada, setEntrada] = useState({
    produtoId: "",
    quantidade: "",
    endereco: "",
    codigoBarras: "",
  });

  const [saida, setSaida] = useState({
    produtoId: "",
    quantidade: "",
    endereco: "",
    observacao: "",
    codigoBarras: "",
  });

  const [movimentacao, setMovimentacao] = useState({
    produtoId: "",
    origem: "",
    destino: "",
    quantidade: "",
    codigoBarras: "",
  });

  const [inventarioModo, setInventarioModo] =
    useState<ModoInventario>("endereco");
  const [inventarioEndereco, setInventarioEndereco] = useState({
    endereco: "",
    produtoId: "",
    quantidade: "",
  });
  const [inventarioProdutoId, setInventarioProdutoId] = useState("");
  const [inventarioProdutoContagens, setInventarioProdutoContagens] = useState<
    Record<string, string>
  >({});

  const [mensagemLogin, setMensagemLogin] = useState(
    "Informe usuário e senha para acessar."
  );
  const [filtroEndereco, setFiltroEndereco] = useState("");

  const [tipoRelatorio, setTipoRelatorio] =
    useState<TipoRelatorio>("produto");
  const [relatorioProdutoId, setRelatorioProdutoId] = useState("");
  const [pdfPronto, setPdfPronto] = useState(false);

  const [coletorEntradaAtivo, setColetorEntradaAtivo] = useState(false);
  const [coletorSaidaAtivo, setColetorSaidaAtivo] = useState(false);
  const [coletorMovAtivo, setColetorMovAtivo] = useState(false);

  const scannerEntradaRef = useRef<HTMLInputElement | null>(null);
  const scannerSaidaRef = useRef<HTMLInputElement | null>(null);
  const scannerMovRef = useRef<HTMLInputElement | null>(null);
  const relatorioRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = usuarioLogado?.perfil === "Administrador";

  useEffect(() => {
    const usuariosSalvos = lerStorage(STORAGE_KEYS.usuarios, usuariosSeed);
    const produtosSalvos = lerStorage(STORAGE_KEYS.produtos, produtosSeed);
    const enderecosSalvos = lerStorage(STORAGE_KEYS.enderecos, enderecosSeed);
    const estoqueSalvo = lerStorage(STORAGE_KEYS.estoque, estoqueSeed);
    const movimentosSalvos = lerStorage(
      STORAGE_KEYS.movimentos,
      movimentosSeed
    );
    const logsSalvos = lerStorage<LogAdmin[]>(STORAGE_KEYS.logsAdmin, []);

    setUsuarios(usuariosSalvos);
    setProdutos(produtosSalvos);
    setEnderecos(enderecosSalvos);
    setEstoque(estoqueSalvo);
    setMovimentos(movimentosSalvos);
    setLogsAdmin(logsSalvos);
    setUsuarioLogado(null);
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    salvarStorage(STORAGE_KEYS.usuarios, usuarios);
  }, [usuarios, carregado]);

  useEffect(() => {
    if (!carregado) return;
    salvarStorage(STORAGE_KEYS.produtos, produtos);
  }, [produtos, carregado]);

  useEffect(() => {
    if (!carregado) return;
    salvarStorage(STORAGE_KEYS.enderecos, enderecos);
  }, [enderecos, carregado]);

  useEffect(() => {
    if (!carregado) return;
    salvarStorage(STORAGE_KEYS.estoque, estoque);
  }, [estoque, carregado]);

  useEffect(() => {
    if (!carregado) return;
    salvarStorage(STORAGE_KEYS.movimentos, movimentos);
  }, [movimentos, carregado]);

  useEffect(() => {
    if (!carregado) return;
    salvarStorage(STORAGE_KEYS.logsAdmin, logsAdmin);
  }, [logsAdmin, carregado]);

  useEffect(() => {
    if (!toast.open) return;
    const timer = setTimeout(() => setToast(toastInicial), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (coletorEntradaAtivo) scannerEntradaRef.current?.focus();
  }, [coletorEntradaAtivo]);

  useEffect(() => {
    if (coletorSaidaAtivo) scannerSaidaRef.current?.focus();
  }, [coletorSaidaAtivo]);

  useEffect(() => {
    if (coletorMovAtivo) scannerMovRef.current?.focus();
  }, [coletorMovAtivo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.html2pdf) {
      setPdfPronto(true);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    script.onload = () => setPdfPronto(true);
    document.body.appendChild(script);
  }, []);

  const mapaProduto = useMemo(
    () => Object.fromEntries(produtos.map((p) => [p.id, `${p.nome} - ${p.ml}ML`])),
    [produtos]
  );

  const mapaProdutoCompleto = useMemo(
    () =>
      Object.fromEntries(produtos.map((p) => [p.id, p])) as Record<
        number,
        Produto
      >,
    [produtos]
  );

  const enderecosComSaldo = useMemo(
    () => new Set(estoque.filter((e) => e.quantidade > 0).map((e) => e.endereco)),
    [estoque]
  );

  const totalEnderecos = enderecos.length;
  const enderecosBloqueados = enderecos.filter(
    (e) => e.status === "Bloqueado"
  ).length;
  const capacidadePalletTotal = totalEnderecos;
  const capacidadePalletUtilizavel = totalEnderecos - enderecosBloqueados;
  const enderecosOcupados = enderecos.filter(
    (e) => e.status !== "Bloqueado" && enderecosComSaldo.has(e.codigo)
  ).length;
  const enderecosLivres = enderecos.filter(
    (e) => e.status !== "Bloqueado" && !enderecosComSaldo.has(e.codigo)
  ).length;
  const percentualOcupacao =
    capacidadePalletUtilizavel === 0
      ? 0
      : Math.round((enderecosOcupados / capacidadePalletUtilizavel) * 100);

  const entradasHoje = movimentos.filter((m) => m.tipo === "Entrada").length;
  const saidasHoje = movimentos.filter((m) => m.tipo === "Saída").length;
  const inventariosHoje = movimentos.filter(
    (m) => m.tipo === "Inventário" || m.tipo === "Ajuste"
  ).length;
  const totalMovimentosHoje = movimentos.length;
  const ultimosMovimentos = movimentos.slice(0, 8);
  const ultimos3Movimentos = movimentos.slice(0, 3);
  const ultimosMovimentosEntrada = movimentos
    .filter((m) => m.tipo === "Entrada")
    .slice(0, 3);
  const ultimosMovimentosSaida = movimentos
    .filter((m) => m.tipo === "Saída")
    .slice(0, 3);

  const indicadoresZonas = useMemo(() => {
    const zonas = ["Rua A", "Rua B", "Rua C"];
    return zonas.map((zona) => {
      const itens = enderecos.filter(
        (e) => e.rua === zona && e.status !== "Bloqueado"
      );
      const ocupados = itens.filter((e) => enderecosComSaldo.has(e.codigo)).length;
      const livres = itens.filter((e) => !enderecosComSaldo.has(e.codigo)).length;
      const picking = itens.filter(
        (e) =>
          e.rua === "Rua B" &&
          e.nivel === "A" &&
          !enderecosComSaldo.has(e.codigo)
      ).length;
      const utilizaveis = itens.length;
      const ocupacao =
        utilizaveis === 0 ? 0 : Math.round((ocupados / utilizaveis) * 100);
      return { zona, ocupados, livres, picking, ocupacao };
    });
  }, [enderecos, enderecosComSaldo]);

  const enderecoPreview = useMemo(() => {
    if (!novoEndereco.predio.trim()) return "";
    return montarCodigoEndereco(
      novoEndereco.rua,
      novoEndereco.predio.trim(),
      novoEndereco.nivel
    );
  }, [novoEndereco]);

  const consolidadoPorItem = useMemo(() => {
    return produtos.map((produto) => ({
      produtoId: produto.id,
      produto: `${produto.nome} - ${produto.ml}ML`,
      curva: produto.curva,
      saldo: estoque
        .filter((e) => e.produtoId === produto.id)
        .reduce((acc, item) => acc + item.quantidade, 0),
    }));
  }, [produtos, estoque]);

  const relatorioProduto = useMemo(() => {
    const produtoId = Number(relatorioProdutoId || 0);
    if (!produtoId) return [] as { endereco: string; quantidade: number }[];
    return estoque
      .filter((e) => e.produtoId === produtoId && e.quantidade > 0)
      .sort((a, b) => a.endereco.localeCompare(b.endereco))
      .map((e) => ({
        endereco: e.endereco,
        quantidade: e.quantidade,
      }));
  }, [relatorioProdutoId, estoque]);

  const relatorioGeral = useMemo(() => {
    return estoque
      .filter((e) => e.quantidade > 0)
      .sort((a, b) => {
        const produtoA = mapaProduto[a.produtoId] || "";
        const produtoB = mapaProduto[b.produtoId] || "";
        return produtoA.localeCompare(produtoB) || a.endereco.localeCompare(b.endereco);
      })
      .map((e) => ({
        produto: mapaProduto[e.produtoId],
        endereco: e.endereco,
        quantidade: e.quantidade,
      }));
  }, [estoque, mapaProduto]);

  const movimentosPorEndereco = useMemo(() => {
    if (!filtroEndereco.trim()) return movimentos;
    return movimentos.filter(
      (m) =>
        m.endereco.toLowerCase().includes(filtroEndereco.trim().toLowerCase()) ||
        (m.enderecoDestino || "")
          .toLowerCase()
          .includes(filtroEndereco.trim().toLowerCase())
    );
  }, [movimentos, filtroEndereco]);

  const sugestoesSaida = useMemo(() => {
    const produtoId = Number(saida.produtoId || 0);
    const qtd = Number(saida.quantidade || 0);
    if (!produtoId || !qtd) {
      return { pallets: [] as Estoque[], picking: [] as Estoque[], restante: qtd };
    }
    const produto = mapaProdutoCompleto[produtoId];
    if (!produto) {
      return { pallets: [] as Estoque[], picking: [] as Estoque[], restante: qtd };
    }

    const locais = estoque
      .filter((e) => e.produtoId === produtoId && e.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade);

    const pallets = locais.filter((e) => e.quantidade >= produto.qtdMaxPallet);
    const picking = locais.filter((e) => e.quantidade < produto.qtdMaxPallet);

    let restante = qtd;
    const palletsIndicados: Estoque[] = [];
    const pickingIndicados: Estoque[] = [];

    for (const item of pallets) {
      if (restante <= 0) break;
      palletsIndicados.push(item);
      restante -= Math.min(restante, item.quantidade);
    }

    for (const item of picking) {
      if (restante <= 0) break;
      pickingIndicados.push(item);
      restante -= Math.min(restante, item.quantidade);
    }

    return { pallets: palletsIndicados, picking: pickingIndicados, restante };
  }, [saida, estoque, mapaProdutoCompleto]);

  const locaisProdutoInventario = useMemo(() => {
    const produtoId = Number(inventarioProdutoId || 0);
    if (!produtoId) return [] as Estoque[];
    return estoque
      .filter((e) => e.produtoId === produtoId)
      .sort((a, b) => a.endereco.localeCompare(b.endereco));
  }, [inventarioProdutoId, estoque]);

  function mostrarToast(type: ToastState["type"], text: string) {
    setToast({ open: true, type, text });
  }

  function sairSistema() {
    setUsuarioLogado(null);
    setLoginForm({ login: "", senha: "" });
    setMensagemLogin("Informe usuário e senha para acessar.");
    setAba("dashboard");
    setMensagemPerfil("");
    setColetorEntradaAtivo(false);
    setColetorSaidaAtivo(false);
    setColetorMovAtivo(false);
    mostrarToast("info", "Sessão encerrada. Faça login novamente.");
  }

  function registrarLogAdmin(tipo: string, detalhe: string) {
    if (!usuarioLogado) return;
    setLogsAdmin((prev) => [
      {
        id: Date.now() + Math.random(),
        data: dataAgora(),
        usuario: usuarioLogado.nome,
        tipo,
        detalhe,
      },
      ...prev,
    ]);
  }

  function registrarMovimento(mov: Omit<Movimento, "id" | "data">) {
    setMovimentos((prev) => [
      {
        id: Date.now() + Math.random(),
        data: dataAgora(),
        ...mov,
      },
      ...prev,
    ]);
  }

  function excluirMovimento(id: number) {
    setMovimentos((prev) => prev.filter((m) => m.id !== id));
    mostrarToast("success", "Movimento excluído com sucesso.");
  }

  function atualizarStatusEnderecoPorEstoque(lista: Estoque[]) {
    setEnderecos((prev) =>
      prev.map((end) => {
        if (end.status === "Bloqueado") return end;
        const temSaldo = lista.some(
          (e) => e.endereco === end.codigo && e.quantidade > 0
        );
        return {
          ...end,
          status: temSaldo
            ? "Ocupado"
            : end.rua === "Rua B" && end.nivel === "A"
            ? "Picking"
            : "Livre",
        };
      })
    );
  }

  function somarEstoque(produtoId: number, endereco: string, quantidade: number) {
    setEstoque((prev) => {
      const idx = prev.findIndex(
        (e) => e.produtoId === produtoId && e.endereco === endereco
      );
      let novaLista = [...prev];
      if (idx >= 0) {
        novaLista[idx] = {
          ...novaLista[idx],
          quantidade: novaLista[idx].quantidade + quantidade,
        };
      } else {
        novaLista.push({
          id: Date.now() + Math.random(),
          produtoId,
          endereco,
          quantidade,
        });
      }
      novaLista = novaLista.filter((e) => e.quantidade > 0);
      atualizarStatusEnderecoPorEstoque(novaLista);
      return novaLista;
    });
  }

  function subtrairEstoque(
    produtoId: number,
    endereco: string,
    quantidade: number
  ) {
    let conseguiu = true;
    setEstoque((prev) => {
      const idx = prev.findIndex(
        (e) => e.produtoId === produtoId && e.endereco === endereco
      );
      if (idx < 0) {
        conseguiu = false;
        return prev;
      }
      const atual = prev[idx];
      if (atual.quantidade < quantidade) {
        conseguiu = false;
        return prev;
      }
      let novaLista = [...prev];
      novaLista[idx] = { ...atual, quantidade: atual.quantidade - quantidade };
      novaLista = novaLista.filter((e) => e.quantidade > 0);
      atualizarStatusEnderecoPorEstoque(novaLista);
      return novaLista;
    });
    return conseguiu;
  }

  function abrirConfirmacao(
    title: string,
    text: string,
    onConfirm: () => void
  ) {
    setConfirmState({ open: true, title, text, onConfirm });
  }

  function fecharConfirmacao() {
    setConfirmState(confirmInicial);
  }

  function executarConfirmacao() {
    if (confirmState.onConfirm) confirmState.onConfirm();
    fecharConfirmacao();
  }

  function entrarSistema() {
    const login = loginForm.login.trim().toUpperCase();
    const senha = loginForm.senha.trim();

    if (!login || !senha) {
      setMensagemLogin("Informe usuário e senha.");
      return;
    }

    const usuario = usuarios.find(
      (u) => u.login === login && u.senha === senha && u.status === "Ativo"
    );

    if (!usuario) {
      setMensagemLogin("Usuário, senha ou status inválido.");
      return;
    }

    setUsuarioLogado({ ...usuario });
    setMensagemPerfil("");
    setLoginForm({ login: "", senha: "" });
    setAba("dashboard");
    mostrarToast("success", `Login realizado com sucesso para ${usuario.nome}.`);
  }

  function validarAcesso(destino: AbaSistema) {
    if (!isAdmin && (destino === "cadastros" || destino === "relatorios")) {
      mostrarToast("error", "Acesso restrito ao administrador.");
      return;
    }
    setAba(destino);
  }

  function sugerirEnderecoEntrada(produtoId: number | null) {
    if (!produtoId) return "";
    const produto = mapaProdutoCompleto[produtoId];
    if (!produto) return "";

    let candidatos = enderecos.filter(
      (e) => e.status !== "Bloqueado" && !enderecosComSaldo.has(e.codigo)
    );

    if (produto.linha === "Impressos") {
      candidatos = candidatos.filter(
        (e) => e.rua === "Rua C" && e.nivel === "A"
      );
    }

    candidatos = candidatos.sort(
      (a, b) => distanciaDoCentro(a.codigo) - distanciaDoCentro(b.codigo)
    );
    return candidatos[0]?.codigo || "";
  }

  useEffect(() => {
    const produtoId = entrada.produtoId ? Number(entrada.produtoId) : null;
    const sugerido = sugerirEnderecoEntrada(produtoId);
    if (sugerido && !entrada.endereco) {
      setEntrada((prev) => ({ ...prev, endereco: sugerido }));
    }
  }, [entrada.produtoId, enderecos, estoque]);

  function preencherDadosProdutoExistentePorML(nomeProduto: string, ml: string) {
    const base = produtos.find(
      (p) =>
        p.nome.trim().toUpperCase() === nomeProduto.trim().toUpperCase() &&
        p.ml.trim().toUpperCase() === ml.trim().toUpperCase()
    );

    if (!base) {
      mostrarToast("info", "Não há dados existentes para este nome + ML.");
      return;
    }

    setNovoProduto((prev) => ({
      ...prev,
      linha: base.linha,
      tipo: base.tipo,
      curva: base.curva,
      qtdPorCaixa: String(base.qtdPorCaixa),
      qtdMaxPallet: String(base.qtdMaxPallet),
      codigoBarras: base.codigoBarras,
    }));

    mostrarToast("info", `Dados existentes carregados para ${base.nome} ${base.ml}ML.`);
  }

  function localizarProdutoPorCodigo(codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) return null;
    return produtos.find((p) => p.codigoBarras.trim() === codigoLimpo) || null;
  }

  function aplicarCodigoNaEntrada(codigo: string) {
    const produto = localizarProdutoPorCodigo(codigo);
    if (!produto) {
      mostrarToast("error", `Código ${codigo} não localizado.`);
      return;
    }
    const sugestao = sugerirEnderecoEntrada(produto.id);
    setEntrada((prev) => ({
      ...prev,
      codigoBarras: codigo,
      produtoId: String(produto.id),
      endereco: prev.endereco || sugestao,
    }));
    mostrarToast("success", `Produto localizado: ${produto.nome} ${produto.ml}ML.`);
  }

  function aplicarCodigoNaSaida(codigo: string) {
    const produto = localizarProdutoPorCodigo(codigo);
    if (!produto) {
      mostrarToast("error", `Código ${codigo} não localizado.`);
      return;
    }
    const locais = estoque
      .filter((e) => e.produtoId === produto.id && e.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade);

    setSaida((prev) => ({
      ...prev,
      codigoBarras: codigo,
      produtoId: String(produto.id),
      endereco: prev.endereco || locais[0]?.endereco || "",
    }));
    mostrarToast("success", `Produto localizado: ${produto.nome} ${produto.ml}ML.`);
  }

  function aplicarCodigoNaMovimentacao(codigo: string) {
    const produto = localizarProdutoPorCodigo(codigo);
    if (!produto) {
      mostrarToast("error", `Código ${codigo} não localizado.`);
      return;
    }
    const locais = estoque
      .filter((e) => e.produtoId === produto.id && e.quantidade > 0)
      .sort((a, b) => b.quantidade - a.quantidade);

    setMovimentacao((prev) => ({
      ...prev,
      codigoBarras: codigo,
      produtoId: String(produto.id),
      origem: prev.origem || locais[0]?.endereco || "",
    }));
    mostrarToast("success", `Produto localizado: ${produto.nome} ${produto.ml}ML.`);
  }

  function adicionarUsuario() {
    if (
      !novoUsuario.nome.trim() ||
      !novoUsuario.login.trim() ||
      !novoUsuario.senha.trim()
    ) {
      mostrarToast("error", "Preencha nome, login e senha do usuário.");
      return;
    }

    const loginExiste = usuarios.some(
      (u) => u.login.toLowerCase() === novoUsuario.login.trim().toLowerCase()
    );
    if (loginExiste) {
      mostrarToast("error", "Já existe um usuário com este login.");
      return;
    }

    abrirConfirmacao(
      "Confirmar cadastro de usuário",
      `Deseja confirmar o cadastro do usuário ${novoUsuario.nome.trim()} com perfil ${novoUsuario.perfil}?`,
      () => {
        setUsuarios((prev) => [
          ...prev,
          {
            id: Date.now(),
            nome: novoUsuario.nome.trim().toUpperCase(),
            login: novoUsuario.login.trim().toUpperCase(),
            senha: novoUsuario.senha.trim(),
            perfil: novoUsuario.perfil,
            status: novoUsuario.status,
          },
        ]);

        setNovoUsuario({
          nome: "",
          login: "",
          senha: "",
          perfil: "Usuário",
          status: "Ativo",
        });

        mostrarToast("success", "Usuário cadastrado com sucesso.");
      }
    );
  }

  function excluirUsuario(id: number, perfil: PerfilUsuario) {
    if (perfil === "Administrador") {
      mostrarToast("error", "Administrador não pode ser excluído.");
      return;
    }
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
    mostrarToast("success", "Usuário excluído com sucesso.");
  }

  function alterarSenhaAtual() {
    if (!usuarioLogado) return;

    const senhaAtual = trocaSenha.atual.trim();
    const senhaNova = trocaSenha.nova.trim();
    const senhaConfirmar = trocaSenha.confirmar.trim();

    if (!senhaAtual || !senhaNova || !senhaConfirmar) {
      setMensagemPerfil("Preencha os 3 campos de senha.");
      mostrarToast("error", "Preencha os 3 campos de senha.");
      return;
    }

    const usuarioBanco = usuarios.find((u) => u.id === usuarioLogado.id);

    if (!usuarioBanco) {
      setMensagemPerfil("Usuário não encontrado para alterar a senha.");
      mostrarToast("error", "Usuário não encontrado para alterar a senha.");
      return;
    }

    if (senhaAtual !== usuarioBanco.senha) {
      setMensagemPerfil("A senha atual está incorreta.");
      mostrarToast("error", "A senha atual está incorreta.");
      return;
    }

    if (senhaNova.length < 4) {
      setMensagemPerfil("A nova senha deve ter pelo menos 4 caracteres.");
      mostrarToast("error", "A nova senha deve ter pelo menos 4 caracteres.");
      return;
    }

    if (senhaNova !== senhaConfirmar) {
      setMensagemPerfil("A confirmação da nova senha não confere.");
      mostrarToast("error", "A confirmação da nova senha não confere.");
      return;
    }

    if (senhaNova === senhaAtual) {
      setMensagemPerfil("A nova senha deve ser diferente da atual.");
      mostrarToast("error", "A nova senha deve ser diferente da atual.");
      return;
    }

    abrirConfirmacao(
      "Confirmar troca de senha",
      "Deseja realmente atualizar sua senha?",
      () => {
        const listaAtualizada = usuarios.map((u) =>
          u.id === usuarioLogado.id ? { ...u, senha: senhaNova } : u
        );
        const usuarioAtualizado =
          listaAtualizada.find((u) => u.id === usuarioLogado.id) || null;
        setUsuarios(listaAtualizada);
        setUsuarioLogado(usuarioAtualizado);
        setTrocaSenha({ atual: "", nova: "", confirmar: "" });
        setMensagemPerfil("Senha alterada com sucesso.");
        registrarLogAdmin(
          "Troca de senha",
          `O usuário ${usuarioBanco.login} alterou a própria senha.`
        );
        mostrarToast("success", "Senha alterada com sucesso.");
      }
    );
  }

  function adicionarProduto() {
    if (
      !novoProduto.nome.trim() ||
      !novoProduto.qtdPorCaixa ||
      !novoProduto.ml ||
      !novoProduto.qtdMaxPallet
    ) {
      mostrarToast(
        "error",
        "Preencha nome, ML, quantidade por caixa e quantidade por pallet."
      );
      return;
    }

    const nome = novoProduto.nome.trim().toLowerCase();
    const repetido = produtos.some(
      (p) => p.nome.toLowerCase() === nome && p.ml === novoProduto.ml.trim()
    );
    if (repetido) {
      mostrarToast("error", "Já existe um produto com o mesmo nome e ML.");
      return;
    }

    abrirConfirmacao(
      "Confirmar cadastro de produto",
      `Deseja confirmar o cadastro do produto ${novoProduto.nome.trim()} com ${novoProduto.ml}ML?`,
      () => {
        setProdutos((prev) => [
          ...prev,
          {
            id: Date.now(),
            nome: novoProduto.nome.trim().toUpperCase(),
            linha: novoProduto.linha,
            tipo: novoProduto.tipo,
            ml: novoProduto.ml.trim(),
            curva: novoProduto.curva,
            qtdPorCaixa: Number(novoProduto.qtdPorCaixa),
            qtdMaxPallet: Number(novoProduto.qtdMaxPallet),
            codigoBarras: novoProduto.codigoBarras.trim(),
          },
        ]);

        setNovoProduto({
          nome: "",
          linha: "Impressos",
          tipo: "Branco",
          ml: "",
          curva: "A",
          qtdPorCaixa: "",
          qtdMaxPallet: "",
          codigoBarras: "",
        });

        mostrarToast("success", "Produto cadastrado com sucesso.");
      }
    );
  }

  function excluirProduto(id: number) {
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    setEstoque((prev) => prev.filter((e) => e.produtoId !== id));
    mostrarToast("success", "Produto excluído com sucesso.");
  }

  function adicionarEndereco() {
    if (!novoEndereco.predio.trim()) {
      mostrarToast("error", "Informe o prédio do endereço.");
      return;
    }

    const codigoMontado = montarCodigoEndereco(
      novoEndereco.rua,
      novoEndereco.predio.trim(),
      novoEndereco.nivel
    );
    const existe = enderecos.some(
      (e) => e.codigo.toLowerCase() === codigoMontado.toLowerCase()
    );

    if (existe) {
      mostrarToast("error", `O endereço ${codigoMontado} já existe.`);
      return;
    }

    abrirConfirmacao(
      "Confirmar cadastro de endereço",
      `Deseja confirmar o cadastro do endereço ${codigoMontado}?`,
      () => {
        setEnderecos((prev) => [
          ...prev,
          {
            id: Date.now(),
            codigo: codigoMontado,
            rua: novoEndereco.rua,
            predio: novoEndereco.predio.trim().padStart(3, "0"),
            nivel: novoEndereco.nivel,
            status: novoEndereco.status,
          },
        ]);
        setNovoEndereco({
          rua: "Rua C",
          predio: "",
          nivel: "A",
          status: "Livre",
        });
        mostrarToast("success", `Endereço ${codigoMontado} cadastrado com sucesso.`);
      }
    );
  }

  function confirmarEntrada() {
    if (!entrada.produtoId || !entrada.quantidade || !entrada.endereco || !usuarioLogado) {
      mostrarToast("error", "Preencha produto, quantidade e endereço da entrada.");
      return;
    }

    const produtoId = Number(entrada.produtoId);
    const quantidade = Number(entrada.quantidade);
    const produto = mapaProdutoCompleto[produtoId];

    if (!produto || quantidade <= 0) {
      mostrarToast("error", "Quantidade de entrada inválida.");
      return;
    }

    const divergente = quantidade !== produto.qtdMaxPallet;

    abrirConfirmacao(
      "Confirmar entrada",
      `Deseja confirmar a entrada de ${quantidade} do item ${produto.nome} no endereço ${entrada.endereco}?`,
      () => {
        somarEstoque(produtoId, entrada.endereco, quantidade);
        registrarMovimento({
          tipo: "Entrada",
          produtoId,
          quantidade,
          endereco: entrada.endereco,
          usuario: usuarioLogado.nome,
          observacao: divergente
            ? "Entrada divergente da quantidade padrão do pallet."
            : "Entrada padrão.",
        });

        if (divergente) {
          registrarLogAdmin(
            "Divergência de entrada",
            `Produto ${produto.nome} entrou com quantidade ${quantidade}, diferente do padrão ${produto.qtdMaxPallet}, no endereço ${entrada.endereco}.`
          );
        }

        setEntrada({
          produtoId: "",
          quantidade: "",
          endereco: "",
          codigoBarras: "",
        });
        mostrarToast("success", `Entrada concluída para ${produto.nome}.`);
      }
    );
  }

  function confirmarSaida() {
    if (!saida.produtoId || !saida.quantidade || !saida.endereco || !usuarioLogado) {
      mostrarToast("error", "Preencha produto, quantidade e endereço da saída.");
      return;
    }

    const produtoId = Number(saida.produtoId);
    const quantidade = Number(saida.quantidade);
    const produto = mapaProdutoCompleto[produtoId];

    if (!produto || quantidade <= 0) {
      mostrarToast("error", "Quantidade de saída inválida.");
      return;
    }

    const local = estoque.find(
      (e) => e.produtoId === produtoId && e.endereco === saida.endereco
    );
    if (!local || local.quantidade < quantidade) {
      mostrarToast("error", "Saldo insuficiente no endereço selecionado.");
      return;
    }

    const divergente = quantidade !== produto.qtdMaxPallet;

    abrirConfirmacao(
      "Confirmar saída",
      `Deseja confirmar a saída de ${quantidade} do item ${produto.nome} no endereço ${saida.endereco}?`,
      () => {
        const ok = subtrairEstoque(produtoId, saida.endereco, quantidade);
        if (!ok) {
          mostrarToast("error", "Não foi possível concluir a saída.");
          return;
        }

        registrarMovimento({
          tipo: "Saída",
          produtoId,
          quantidade,
          endereco: saida.endereco,
          usuario: usuarioLogado.nome,
          observacao:
            saida.observacao ||
            (divergente ? "Saída divergente da quantidade padrão." : "Saída padrão."),
        });

        if (divergente) {
          registrarLogAdmin(
            "Divergência de saída",
            `Produto ${produto.nome} saiu com quantidade ${quantidade}, diferente do padrão ${produto.qtdMaxPallet}, no endereço ${saida.endereco}.`
          );
        }

        setSaida({
          produtoId: "",
          quantidade: "",
          endereco: "",
          observacao: "",
          codigoBarras: "",
        });
        mostrarToast("success", `Saída concluída para ${produto.nome}.`);
      }
    );
  }

  function confirmarMovimentacao() {
    if (
      !movimentacao.produtoId ||
      !movimentacao.origem ||
      !movimentacao.destino ||
      !movimentacao.quantidade ||
      !usuarioLogado
    ) {
      mostrarToast("error", "Preencha produto, origem, destino e quantidade.");
      return;
    }

    const produtoId = Number(movimentacao.produtoId);
    const quantidade = Number(movimentacao.quantidade);

    if (movimentacao.origem === movimentacao.destino || quantidade <= 0) {
      mostrarToast(
        "error",
        "Origem e destino devem ser diferentes e a quantidade deve ser válida."
      );
      return;
    }

    abrirConfirmacao(
      "Confirmar movimentação",
      `Deseja mover ${quantidade} do item ${mapaProduto[produtoId]} de ${movimentacao.origem} para ${movimentacao.destino}?`,
      () => {
        const ok = subtrairEstoque(produtoId, movimentacao.origem, quantidade);
        if (!ok) {
          mostrarToast("error", "Não foi possível concluir a movimentação.");
          return;
        }

        somarEstoque(produtoId, movimentacao.destino, quantidade);
        registrarMovimento({
          tipo: "Transferência",
          produtoId,
          quantidade,
          endereco: movimentacao.origem,
          enderecoDestino: movimentacao.destino,
          usuario: usuarioLogado.nome,
          observacao: "Movimentação interna de/para.",
        });

        setMovimentacao({
          produtoId: "",
          origem: "",
          destino: "",
          quantidade: "",
          codigoBarras: "",
        });
        mostrarToast("success", "Movimentação concluída com sucesso.");
      }
    );
  }

  function confirmarInventarioEndereco() {
    if (
      !inventarioEndereco.endereco ||
      !inventarioEndereco.produtoId ||
      !inventarioEndereco.quantidade ||
      !usuarioLogado
    ) {
      mostrarToast("error", "Preencha endereço, produto e quantidade do inventário.");
      return;
    }

    const produtoId = Number(inventarioEndereco.produtoId);
    const contado = Number(inventarioEndereco.quantidade);
    const endereco = inventarioEndereco.endereco;
    const atual = estoque.find(
      (e) => e.produtoId === produtoId && e.endereco === endereco
    );
    const sist = atual?.quantidade || 0;
    const divergencia = contado - sist;

    abrirConfirmacao(
      "Confirmar inventário por endereço",
      `Deseja lançar contagem ${contado} para ${mapaProduto[produtoId]} no endereço ${endereco}?`,
      () => {
        setEstoque((prev) => {
          const idx = prev.findIndex(
            (e) => e.produtoId === produtoId && e.endereco === endereco
          );
          let novaLista = [...prev];

          if (idx >= 0) {
            novaLista[idx] = { ...novaLista[idx], quantidade: contado };
          } else {
            novaLista.push({
              id: Date.now() + Math.random(),
              produtoId,
              endereco,
              quantidade: contado,
            });
          }

          novaLista = novaLista.filter((e) => e.quantidade > 0);
          atualizarStatusEnderecoPorEstoque(novaLista);
          return novaLista;
        });

        registrarMovimento({
          tipo: "Inventário",
          produtoId,
          quantidade: contado,
          endereco,
          usuario: usuarioLogado.nome,
          observacao: `Inventário por endereço. Sistema ${sist}, contado ${contado}.`,
        });

        if (divergencia !== 0) {
          registrarMovimento({
            tipo: "Divergência",
            produtoId,
            quantidade: divergencia,
            endereco,
            usuario: usuarioLogado.nome,
            observacao: `Divergência identificada no inventário por endereço. Sistema ${sist}, contado ${contado}.`,
          });

          registrarLogAdmin(
            "Divergência de inventário",
            `Produto ${mapaProduto[produtoId]} no endereço ${endereco} teve divergência. Sistema ${sist}, contado ${contado}.`
          );
        }

        setInventarioEndereco({
          endereco: "",
          produtoId: "",
          quantidade: "",
        });
        mostrarToast("success", "Inventário por endereço concluído com sucesso.");
      }
    );
  }

  function salvarInventarioPorProduto() {
    if (!inventarioProdutoId || !usuarioLogado) {
      mostrarToast("error", "Selecione um produto para o inventário.");
      return;
    }

    const produtoId = Number(inventarioProdutoId);
    const locais = locaisProdutoInventario;

    if (locais.length === 0) {
      mostrarToast(
        "error",
        "Este produto não possui saldo em endereços para inventário."
      );
      return;
    }

    abrirConfirmacao(
      "Salvar inventário por produto",
      `Deseja salvar a contagem por produto de ${mapaProduto[produtoId]}?`,
      () => {
        setEstoque((prev) => {
          let novaLista = [...prev];

          locais.forEach((local) => {
            const valorDigitado = Number(
              inventarioProdutoContagens[local.endereco] === undefined
                ? local.quantidade
                : inventarioProdutoContagens[local.endereco]
            );

            novaLista = novaLista.map((e) =>
              e.produtoId === produtoId && e.endereco === local.endereco
                ? { ...e, quantidade: valorDigitado }
                : e
            );

            const sist = local.quantidade;
            const divergencia = valorDigitado - sist;

            registrarMovimento({
              tipo: "Inventário",
              produtoId,
              quantidade: valorDigitado,
              endereco: local.endereco,
              usuario: usuarioLogado.nome,
              observacao: `Inventário por produto. Sistema ${sist}, contado ${valorDigitado}.`,
            });

            if (divergencia !== 0) {
              registrarMovimento({
                tipo: "Ajuste",
                produtoId,
                quantidade: divergencia,
                endereco: local.endereco,
                usuario: usuarioLogado.nome,
                observacao: `Ajuste por inventário do produto. Sistema ${sist}, contado ${valorDigitado}.`,
              });

              registrarLogAdmin(
                "Ajuste por inventário",
                `Produto ${mapaProduto[produtoId]} no endereço ${local.endereco} alterado de ${sist} para ${valorDigitado}.`
              );
            }
          });

          novaLista = novaLista.filter((e) => e.quantidade > 0);
          atualizarStatusEnderecoPorEstoque(novaLista);
          return novaLista;
        });

        setInventarioProdutoContagens({});
        mostrarToast("success", "Inventário por produto salvo com sucesso.");
      }
    );
  }

  async function exportarRelatorioPDF() {
    if (!relatorioRef.current) {
      mostrarToast("error", "Área do relatório não localizada.");
      return;
    }
    if (!window.html2pdf) {
      mostrarToast("error", "Biblioteca de PDF ainda não carregou.");
      return;
    }

    const nomeArquivo =
      tipoRelatorio === "produto"
        ? `relatorio-produto-${relatorioProdutoId || "sem-produto"}.pdf`
        : "relatorio-geral-estoque.pdf";

    const opt = {
      margin: 8,
      filename: nomeArquivo,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    await window.html2pdf().set(opt).from(relatorioRef.current).save();
    mostrarToast("success", "PDF gerado com sucesso.");
  }

  function renderTopActions() {
    if (aba === "dashboard") return null;
    return (
      <div style={styles.topBar}>
        <button style={styles.buttonSecondary} onClick={() => setAba("dashboard")}>
          Voltar para o painel
        </button>
      </div>
    );
  }

  function linhaMovimento(m: Movimento, podeExcluir = false) {
    return (
      <tr key={m.id}>
        <td style={styles.td}>{m.tipo}</td>
        <td style={styles.td}>{m.data}</td>
        <td style={styles.td}>{mapaProduto[m.produtoId] || "Produto excluído"}</td>
        <td style={styles.td}>
          {m.endereco}
          {m.enderecoDestino ? ` → ${m.enderecoDestino}` : ""}
        </td>
        <td style={styles.td}>{m.quantidade}</td>
        <td style={styles.td}>{m.usuario}</td>
        <td style={styles.td}>{m.observacao || "-"}</td>
        <td style={styles.td}>
          {podeExcluir ? (
            <button
              style={styles.buttonDanger}
              onClick={() =>
                abrirConfirmacao(
                  "Excluir movimento",
                  `Deseja excluir o movimento ${m.tipo} de ${
                    mapaProduto[m.produtoId] || "produto"
                  }?`,
                  () => excluirMovimento(m.id)
                )
              }
            >
              Excluir
            </button>
          ) : (
            <span style={styles.smallMuted}>-</span>
          )}
        </td>
      </tr>
    );
  }

  if (!carregado) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginCard}>
          <h2 style={{ marginTop: 0 }}>Carregando...</h2>
        </div>
      </div>
    );
  }

  if (!usuarioLogado) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginCard}>
          <div style={{ marginBottom: 18 }}>
            <div style={styles.badge}>Sistema</div>
            <h1 style={{ margin: "10px 0 8px 0" }}>Sistema WMS VMD</h1>
            <p style={styles.smallMuted}>Entrar no sistema</p>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Usuário</label>
            <input
              style={styles.input}
              value={loginForm.login}
              onChange={(e) =>
                setLoginForm({ ...loginForm, login: e.target.value.toUpperCase() })
              }
              placeholder="Digite o login"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              style={styles.input}
              value={loginForm.senha}
              onChange={(e) =>
                setLoginForm({ ...loginForm, senha: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") entrarSistema();
              }}
              placeholder="Digite a senha"
            />
          </div>

          <p style={{ ...styles.smallMuted, marginBottom: 14 }}>{mensagemLogin}</p>
          <button style={{ ...styles.buttonPrimary, width: "100%" }} onClick={entrarSistema}>
            Entrar
          </button>
        </div>

        {toast.open && (
          <div
            style={{
              ...styles.toast,
              background:
                toast.type === "success"
                  ? "#2e7d32"
                  : toast.type === "error"
                  ? "#c62828"
                  : "#1565c0",
            }}
          >
            {toast.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.appShell}>
        <aside style={styles.sidebar}>
          <div style={styles.brand}>
            <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>
              Sistema
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
              WMS VMD
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.88 }}>
              {usuarioLogado.nome} · {usuarioLogado.perfil}
            </div>
          </div>

          {[
            ["dashboard", "Dashboard"],
            ["cadastros", "Cadastros"],
            ["entrada", "Entrada"],
            ["saida", "Saída"],
            ["movimentacoes", "Movimentações"],
            ["inventario", "Inventário"],
            ["relatorios", "Relatórios"],
            ["perfil", "Perfil"],
          ].map(([valor, titulo]) => (
            <button
              key={valor}
              style={{
                ...styles.navButton,
                ...(aba === valor ? styles.navButtonActive : {}),
              }}
              onClick={() => validarAcesso(valor as AbaSistema)}
            >
              {titulo}
            </button>
          ))}

          <div style={{ marginTop: "auto" }}>
            <button
              style={{
                ...styles.navButton,
                background: "#c62828",
                borderColor: "#c62828",
              }}
              onClick={sairSistema}
            >
              Sair do sistema
            </button>
          </div>
        </aside>

        <main style={styles.content}>
          {aba !== "dashboard" && renderTopActions()}

          {aba === "dashboard" && (
            <div style={styles.sectionGap}>
              <div style={styles.topBar}>
                <div>
                  <h1 style={{ margin: 0 }}>Dashboard</h1>
                  <p style={styles.smallMuted}>
                    Visão geral da operação e da ocupação do armazém
                  </p>
                </div>
                <div style={styles.badge}>Capacidade pallet</div>
              </div>

              <div style={styles.row}>
                <div style={styles.metric}>
                  <div>Capacidade pallet</div>
                  <div style={styles.metricNumber}>
                    {capacidadePalletTotal.toLocaleString("pt-BR")}
                  </div>
                  <div style={styles.smallMuted}>
                    Utilizável: {capacidadePalletUtilizavel.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div style={styles.metric}>
                  <div>Ocupados</div>
                  <div style={styles.metricNumber}>
                    {enderecosOcupados.toLocaleString("pt-BR")}
                  </div>
                  <div style={styles.smallMuted}>Endereços com saldo</div>
                </div>
                <div style={styles.metric}>
                  <div>Disponíveis</div>
                  <div style={styles.metricNumber}>
                    {enderecosLivres.toLocaleString("pt-BR")}
                  </div>
                  <div style={styles.smallMuted}>Endereços livres</div>
                </div>
                <div style={styles.metric}>
                  <div>Ocupação</div>
                  <div style={styles.metricNumber}>{percentualOcupacao}%</div>
                  <div style={styles.smallMuted}>Uso atual da capacidade</div>
                </div>
              </div>

              <div style={styles.row}>
                {indicadoresZonas.map((zona) => (
                  <div key={zona.zona} style={styles.card}>
                    <h3 style={{ marginTop: 0 }}>{zona.zona}</h3>
                    <div style={{ fontWeight: 900, fontSize: 28 }}>
                      {zona.ocupacao}%
                    </div>
                    <p style={styles.smallMuted}>Ocupação da rua</p>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div>Ocupados: {zona.ocupados}</div>
                      <div>Livres: {zona.livres}</div>
                      <div>Picking: {zona.picking}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.row}>
                <div style={styles.metric}>
                  <div>Entradas</div>
                  <div style={styles.metricNumber}>{entradasHoje}</div>
                </div>
                <div style={styles.metric}>
                  <div>Saídas</div>
                  <div style={styles.metricNumber}>{saidasHoje}</div>
                </div>
                <div style={styles.metric}>
                  <div>Inventários</div>
                  <div style={styles.metricNumber}>{inventariosHoje}</div>
                </div>
                <div style={styles.metric}>
                  <div>Movimentos</div>
                  <div style={styles.metricNumber}>{totalMovimentosHoje}</div>
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Últimos movimentos</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Produto</th>
                        <th style={styles.th}>Endereço</th>
                        <th style={styles.th}>Qtd</th>
                        <th style={styles.th}>Usuário</th>
                        <th style={styles.th}>Observação</th>
                        <th style={styles.th}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimosMovimentos.length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={8}>
                            Sem movimentos registrados.
                          </td>
                        </tr>
                      ) : (
                        ultimosMovimentos.map((m) => linhaMovimento(m, false))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {aba === "cadastros" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Cadastros</h1>

              <div style={styles.row}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Cadastrar produto</h3>
                  <div style={styles.field}>
                    <label style={styles.label}>Nome</label>
                    <input
                      style={styles.input}
                      value={novoProduto.nome}
                      onChange={(e) =>
                        setNovoProduto({
                          ...novoProduto,
                          nome: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>ML</label>
                      <input
                        style={styles.input}
                        value={novoProduto.ml}
                        onChange={(e) =>
                          setNovoProduto({ ...novoProduto, ml: e.target.value })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Linha</label>
                      <select
                        style={styles.select}
                        value={novoProduto.linha}
                        onChange={(e) =>
                          setNovoProduto({ ...novoProduto, linha: e.target.value })
                        }
                      >
                        <option>Impressos</option>
                        <option>Flexíveis</option>
                        <option>Filmes</option>
                      </select>
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Tipo</label>
                      <input
                        style={styles.input}
                        value={novoProduto.tipo}
                        onChange={(e) =>
                          setNovoProduto({ ...novoProduto, tipo: e.target.value })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Curva</label>
                      <select
                        style={styles.select}
                        value={novoProduto.curva}
                        onChange={(e) =>
                          setNovoProduto({
                            ...novoProduto,
                            curva: e.target.value as CurvaABC,
                          })
                        }
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Qtd por caixa</label>
                      <input
                        style={styles.input}
                        value={novoProduto.qtdPorCaixa}
                        onChange={(e) =>
                          setNovoProduto({
                            ...novoProduto,
                            qtdPorCaixa: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Qtd máx pallet</label>
                      <input
                        style={styles.input}
                        value={novoProduto.qtdMaxPallet}
                        onChange={(e) =>
                          setNovoProduto({
                            ...novoProduto,
                            qtdMaxPallet: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Código de barras</label>
                    <input
                      style={styles.input}
                      value={novoProduto.codigoBarras}
                      onChange={(e) =>
                        setNovoProduto({
                          ...novoProduto,
                          codigoBarras: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div style={styles.lineActions}>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() =>
                        preencherDadosProdutoExistentePorML(
                          novoProduto.nome,
                          novoProduto.ml
                        )
                      }
                    >
                      Aproveitar dados existentes
                    </button>
                    <button style={styles.buttonPrimary} onClick={adicionarProduto}>
                      Cadastrar produto
                    </button>
                  </div>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Cadastrar endereço</h3>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Rua</label>
                      <select
                        style={styles.select}
                        value={novoEndereco.rua}
                        onChange={(e) =>
                          setNovoEndereco({ ...novoEndereco, rua: e.target.value })
                        }
                      >
                        <option>Rua A</option>
                        <option>Rua B</option>
                        <option>Rua C</option>
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Prédio</label>
                      <input
                        style={styles.input}
                        value={novoEndereco.predio}
                        onChange={(e) =>
                          setNovoEndereco({
                            ...novoEndereco,
                            predio: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Nível</label>
                      <select
                        style={styles.select}
                        value={novoEndereco.nivel}
                        onChange={(e) =>
                          setNovoEndereco({ ...novoEndereco, nivel: e.target.value })
                        }
                      >
                        <option>A</option>
                        <option>B</option>
                        <option>C</option>
                        <option>D</option>
                        <option>E</option>
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Status</label>
                      <select
                        style={styles.select}
                        value={novoEndereco.status}
                        onChange={(e) =>
                          setNovoEndereco({
                            ...novoEndereco,
                            status: e.target.value as StatusEndereco,
                          })
                        }
                      >
                        <option>Livre</option>
                        <option>Picking</option>
                        <option>Bloqueado</option>
                        <option>Ocupado</option>
                      </select>
                    </div>
                  </div>
                  <p style={styles.smallMuted}>Preview: {enderecoPreview || "-"}</p>
                  <button style={styles.buttonPrimary} onClick={adicionarEndereco}>
                    Cadastrar endereço
                  </button>
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Cadastrar usuário</h3>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Nome</label>
                    <input
                      style={styles.input}
                      value={novoUsuario.nome}
                      onChange={(e) =>
                        setNovoUsuario({
                          ...novoUsuario,
                          nome: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Login</label>
                    <input
                      style={styles.input}
                      value={novoUsuario.login}
                      onChange={(e) =>
                        setNovoUsuario({
                          ...novoUsuario,
                          login: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Senha</label>
                    <input
                      style={styles.input}
                      value={novoUsuario.senha}
                      onChange={(e) =>
                        setNovoUsuario({ ...novoUsuario, senha: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Perfil</label>
                    <select
                      style={styles.select}
                      value={novoUsuario.perfil}
                      onChange={(e) =>
                        setNovoUsuario({
                          ...novoUsuario,
                          perfil: e.target.value as PerfilUsuario,
                        })
                      }
                    >
                      <option>Usuário</option>
                      <option>Administrador</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Status</label>
                    <select
                      style={styles.select}
                      value={novoUsuario.status}
                      onChange={(e) =>
                        setNovoUsuario({
                          ...novoUsuario,
                          status: e.target.value as Usuario["status"],
                        })
                      }
                    >
                      <option>Ativo</option>
                      <option>Inativo</option>
                    </select>
                  </div>
                </div>
                <button style={styles.buttonPrimary} onClick={adicionarUsuario}>
                  Cadastrar usuário
                </button>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Produtos cadastrados</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Produto</th>
                        <th style={styles.th}>Linha</th>
                        <th style={styles.th}>ML</th>
                        <th style={styles.th}>Curva</th>
                        <th style={styles.th}>Pallet</th>
                        <th style={styles.th}>Código</th>
                        <th style={styles.th}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((p) => (
                        <tr key={p.id}>
                          <td style={styles.td}>{p.nome}</td>
                          <td style={styles.td}>{p.linha}</td>
                          <td style={styles.td}>{p.ml}</td>
                          <td style={styles.td}>{p.curva}</td>
                          <td style={styles.td}>{p.qtdMaxPallet}</td>
                          <td style={styles.td}>{p.codigoBarras}</td>
                          <td style={styles.td}>
                            <button
                              style={styles.buttonDanger}
                              onClick={() => excluirProduto(p.id)}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Usuários cadastrados</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Nome</th>
                        <th style={styles.th}>Login</th>
                        <th style={styles.th}>Perfil</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u) => (
                        <tr key={u.id}>
                          <td style={styles.td}>{u.nome}</td>
                          <td style={styles.td}>{u.login}</td>
                          <td style={styles.td}>{u.perfil}</td>
                          <td style={styles.td}>{u.status}</td>
                          <td style={styles.td}>
                            {u.perfil === "Administrador" ? (
                              <span style={styles.smallMuted}>Protegido</span>
                            ) : (
                              <button
                                style={styles.buttonDanger}
                                onClick={() => excluirUsuario(u.id, u.perfil)}
                              >
                                Excluir
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {aba === "entrada" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Entrada</h1>

              <div style={styles.row}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Operação de entrada</h3>

                  <div style={styles.lineActions}>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => {
                        const novo = !coletorEntradaAtivo;
                        setColetorEntradaAtivo(novo);
                        if (novo) {
                          setColetorSaidaAtivo(false);
                          setColetorMovAtivo(false);
                          setTimeout(() => scannerEntradaRef.current?.focus(), 50);
                        }
                      }}
                    >
                      {coletorEntradaAtivo ? "Coletor ativo" : "Usar coletor"}
                    </button>
                  </div>

                  {coletorEntradaAtivo && (
                    <div style={{ ...styles.field, marginTop: 12 }}>
                      <label style={styles.label}>Leitura código de barras</label>
                      <input
                        ref={scannerEntradaRef}
                        style={styles.input}
                        value={entrada.codigoBarras}
                        onChange={(e) =>
                          setEntrada((prev) => ({
                            ...prev,
                            codigoBarras: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            aplicarCodigoNaEntrada(entrada.codigoBarras);
                          }
                        }}
                        onBlur={() => {
                          if (coletorEntradaAtivo) {
                            setTimeout(() => scannerEntradaRef.current?.focus(), 20);
                          }
                        }}
                      />
                    </div>
                  )}

                  <div style={styles.field}>
                    <label style={styles.label}>Produto</label>
                    <select
                      style={styles.select}
                      value={entrada.produtoId}
                      onChange={(e) =>
                        setEntrada({
                          ...entrada,
                          produtoId: e.target.value,
                          endereco: "",
                        })
                      }
                    >
                      <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} - {p.ml}ML
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Quantidade</label>
                      <input
                        style={styles.input}
                        value={entrada.quantidade}
                        onChange={(e) =>
                          setEntrada({ ...entrada, quantidade: e.target.value })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Endereço</label>
                      <input
                        style={styles.input}
                        value={entrada.endereco}
                        onChange={(e) =>
                          setEntrada({
                            ...entrada,
                            endereco: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                  </div>

                  <button style={styles.buttonPrimary} onClick={confirmarEntrada}>
                    Confirmar entrada
                  </button>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Últimas 3 entradas</h3>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Data</th>
                          <th style={styles.th}>Produto</th>
                          <th style={styles.th}>Endereço</th>
                          <th style={styles.th}>Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ultimosMovimentosEntrada.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={4}>
                              Sem entradas registradas.
                            </td>
                          </tr>
                        ) : (
                          ultimosMovimentosEntrada.map((m) => (
                            <tr key={m.id}>
                              <td style={styles.td}>{m.data}</td>
                              <td style={styles.td}>{mapaProduto[m.produtoId]}</td>
                              <td style={styles.td}>{m.endereco}</td>
                              <td style={styles.td}>{m.quantidade}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {aba === "saida" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Saída</h1>

              <div style={styles.row}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Operação de saída</h3>

                  <div style={styles.lineActions}>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => {
                        const novo = !coletorSaidaAtivo;
                        setColetorSaidaAtivo(novo);
                        if (novo) {
                          setColetorEntradaAtivo(false);
                          setColetorMovAtivo(false);
                          setTimeout(() => scannerSaidaRef.current?.focus(), 50);
                        }
                      }}
                    >
                      {coletorSaidaAtivo ? "Coletor ativo" : "Usar coletor"}
                    </button>
                  </div>

                  {coletorSaidaAtivo && (
                    <div style={{ ...styles.field, marginTop: 12 }}>
                      <label style={styles.label}>Leitura código de barras</label>
                      <input
                        ref={scannerSaidaRef}
                        style={styles.input}
                        value={saida.codigoBarras}
                        onChange={(e) =>
                          setSaida((prev) => ({
                            ...prev,
                            codigoBarras: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            aplicarCodigoNaSaida(saida.codigoBarras);
                          }
                        }}
                        onBlur={() => {
                          if (coletorSaidaAtivo) {
                            setTimeout(() => scannerSaidaRef.current?.focus(), 20);
                          }
                        }}
                      />
                    </div>
                  )}

                  <div style={styles.field}>
                    <label style={styles.label}>Produto</label>
                    <select
                      style={styles.select}
                      value={saida.produtoId}
                      onChange={(e) =>
                        setSaida({ ...saida, produtoId: e.target.value })
                      }
                    >
                      <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} - {p.ml}ML
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Quantidade</label>
                      <input
                        style={styles.input}
                        value={saida.quantidade}
                        onChange={(e) =>
                          setSaida({ ...saida, quantidade: e.target.value })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Endereço</label>
                      <input
                        style={styles.input}
                        value={saida.endereco}
                        onChange={(e) =>
                          setSaida({
                            ...saida,
                            endereco: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Observação</label>
                    <textarea
                      style={styles.textarea}
                      value={saida.observacao}
                      onChange={(e) =>
                        setSaida({ ...saida, observacao: e.target.value })
                      }
                    />
                  </div>

                  <button style={styles.buttonPrimary} onClick={confirmarSaida}>
                    Confirmar saída
                  </button>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Sugestões de separação</h3>
                  <p style={styles.smallMuted}>Pallets sugeridos</p>
                  {sugestoesSaida.pallets.length === 0 ? (
                    <p style={styles.smallMuted}>Sem pallets sugeridos.</p>
                  ) : (
                    sugestoesSaida.pallets.map((p) => (
                      <div key={p.id} style={{ marginBottom: 8 }}>
                        {p.endereco} · {p.quantidade}
                      </div>
                    ))
                  )}

                  <p style={{ ...styles.smallMuted, marginTop: 12 }}>
                    Picking sugerido
                  </p>
                  {sugestoesSaida.picking.length === 0 ? (
                    <p style={styles.smallMuted}>
                      Sem endereços de picking sugeridos.
                    </p>
                  ) : (
                    sugestoesSaida.picking.map((p) => (
                      <div key={p.id} style={{ marginBottom: 8 }}>
                        {p.endereco} · {p.quantidade}
                      </div>
                    ))
                  )}

                  <p style={{ fontWeight: 800, marginTop: 14 }}>
                    Restante: {sugestoesSaida.restante}
                  </p>
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Últimas 3 saídas</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Produto</th>
                        <th style={styles.th}>Endereço</th>
                        <th style={styles.th}>Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimosMovimentosSaida.length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={4}>
                            Sem saídas registradas.
                          </td>
                        </tr>
                      ) : (
                        ultimosMovimentosSaida.map((m) => (
                          <tr key={m.id}>
                            <td style={styles.td}>{m.data}</td>
                            <td style={styles.td}>{mapaProduto[m.produtoId]}</td>
                            <td style={styles.td}>{m.endereco}</td>
                            <td style={styles.td}>{m.quantidade}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {aba === "movimentacoes" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Movimentações</h1>

              <div style={styles.row}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Transferência de/para</h3>

                  <div style={styles.lineActions}>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => {
                        const novo = !coletorMovAtivo;
                        setColetorMovAtivo(novo);
                        if (novo) {
                          setColetorEntradaAtivo(false);
                          setColetorSaidaAtivo(false);
                          setTimeout(() => scannerMovRef.current?.focus(), 50);
                        }
                      }}
                    >
                      {coletorMovAtivo ? "Coletor ativo" : "Usar coletor"}
                    </button>
                  </div>

                  {coletorMovAtivo && (
                    <div style={{ ...styles.field, marginTop: 12 }}>
                      <label style={styles.label}>Leitura código de barras</label>
                      <input
                        ref={scannerMovRef}
                        style={styles.input}
                        value={movimentacao.codigoBarras}
                        onChange={(e) =>
                          setMovimentacao((prev) => ({
                            ...prev,
                            codigoBarras: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            aplicarCodigoNaMovimentacao(movimentacao.codigoBarras);
                          }
                        }}
                        onBlur={() => {
                          if (coletorMovAtivo) {
                            setTimeout(() => scannerMovRef.current?.focus(), 20);
                          }
                        }}
                      />
                    </div>
                  )}

                  <div style={styles.field}>
                    <label style={styles.label}>Produto</label>
                    <select
                      style={styles.select}
                      value={movimentacao.produtoId}
                      onChange={(e) =>
                        setMovimentacao({
                          ...movimentacao,
                          produtoId: e.target.value,
                        })
                      }
                    >
                      <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} - {p.ml}ML
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Origem</label>
                      <input
                        style={styles.input}
                        value={movimentacao.origem}
                        onChange={(e) =>
                          setMovimentacao({
                            ...movimentacao,
                            origem: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Destino</label>
                      <input
                        style={styles.input}
                        value={movimentacao.destino}
                        onChange={(e) =>
                          setMovimentacao({
                            ...movimentacao,
                            destino: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Quantidade</label>
                    <input
                      style={styles.input}
                      value={movimentacao.quantidade}
                      onChange={(e) =>
                        setMovimentacao({
                          ...movimentacao,
                          quantidade: e.target.value,
                        })
                      }
                    />
                  </div>

                  <button
                    style={styles.buttonPrimary}
                    onClick={confirmarMovimentacao}
                  >
                    Confirmar movimentação
                  </button>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Histórico por endereço</h3>
                  <div style={styles.field}>
                    <label style={styles.label}>Filtrar endereço</label>
                    <input
                      style={styles.input}
                      value={filtroEndereco}
                      onChange={(e) =>
                        setFiltroEndereco(e.target.value.toUpperCase())
                      }
                    />
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Tipo</th>
                          <th style={styles.th}>Data</th>
                          <th style={styles.th}>Produto</th>
                          <th style={styles.th}>Endereço</th>
                          <th style={styles.th}>Qtd</th>
                          <th style={styles.th}>Usuário</th>
                          <th style={styles.th}>Obs</th>
                          <th style={styles.th}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimentosPorEndereco.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={8}>
                              Sem movimentos para o filtro.
                            </td>
                          </tr>
                        ) : (
                          movimentosPorEndereco
                            .slice(0, 30)
                            .map((m) => linhaMovimento(m, true))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {aba === "inventario" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Inventário</h1>

              <div style={styles.lineActions}>
                <button
                  style={
                    inventarioModo === "endereco"
                      ? styles.buttonPrimary
                      : styles.buttonSecondary
                  }
                  onClick={() => setInventarioModo("endereco")}
                >
                  Por endereço
                </button>
                <button
                  style={
                    inventarioModo === "produto"
                      ? styles.buttonPrimary
                      : styles.buttonSecondary
                  }
                  onClick={() => setInventarioModo("produto")}
                >
                  Por produto
                </button>
              </div>

              {inventarioModo === "endereco" && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Inventário por endereço</h3>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Endereço</label>
                      <input
                        style={styles.input}
                        value={inventarioEndereco.endereco}
                        onChange={(e) =>
                          setInventarioEndereco({
                            ...inventarioEndereco,
                            endereco: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Produto</label>
                      <select
                        style={styles.select}
                        value={inventarioEndereco.produtoId}
                        onChange={(e) =>
                          setInventarioEndereco({
                            ...inventarioEndereco,
                            produtoId: e.target.value,
                          })
                        }
                      >
                        <option value="">Selecione</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} - {p.ml}ML
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Quantidade contada</label>
                      <input
                        style={styles.input}
                        value={inventarioEndereco.quantidade}
                        onChange={(e) =>
                          setInventarioEndereco({
                            ...inventarioEndereco,
                            quantidade: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <button
                    style={styles.buttonPrimary}
                    onClick={confirmarInventarioEndereco}
                  >
                    Salvar inventário por endereço
                  </button>
                </div>
              )}

              {inventarioModo === "produto" && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Inventário por produto</h3>
                  <div style={styles.field}>
                    <label style={styles.label}>Produto</label>
                    <select
                      style={styles.select}
                      value={inventarioProdutoId}
                      onChange={(e) => setInventarioProdutoId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} - {p.ml}ML
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Endereço</th>
                          <th style={styles.th}>Sistema</th>
                          <th style={styles.th}>Contado</th>
                          <th style={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locaisProdutoInventario.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={4}>
                              Selecione um produto com saldo.
                            </td>
                          </tr>
                        ) : (
                          locaisProdutoInventario.map((local) => {
                            const valorDigitado =
                              inventarioProdutoContagens[local.endereco] ??
                              String(local.quantidade);
                            const bate = Number(valorDigitado) === local.quantidade;

                            return (
                              <tr key={local.id}>
                                <td style={styles.td}>{local.endereco}</td>
                                <td style={styles.td}>{local.quantidade}</td>
                                <td style={styles.td}>
                                  <input
                                    style={styles.input}
                                    value={valorDigitado}
                                    onChange={(e) =>
                                      setInventarioProdutoContagens((prev) => ({
                                        ...prev,
                                        [local.endereco]: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td
                                  style={{
                                    ...styles.td,
                                    color: bate ? "#2e7d32" : "#c62828",
                                    fontWeight: 800,
                                  }}
                                >
                                  {bate ? "Confere" : "Divergente"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <button
                      style={styles.buttonPrimary}
                      onClick={salvarInventarioPorProduto}
                    >
                      Salvar inventário por produto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {aba === "relatorios" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Relatórios</h1>

              <div style={styles.card}>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Tipo</label>
                    <select
                      style={styles.select}
                      value={tipoRelatorio}
                      onChange={(e) =>
                        setTipoRelatorio(e.target.value as TipoRelatorio)
                      }
                    >
                      <option value="produto">Por produto</option>
                      <option value="geral">Geral</option>
                    </select>
                  </div>

                  {tipoRelatorio === "produto" && (
                    <div style={styles.field}>
                      <label style={styles.label}>Produto</label>
                      <select
                        style={styles.select}
                        value={relatorioProdutoId}
                        onChange={(e) => setRelatorioProdutoId(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} - {p.ml}ML
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={styles.lineActions}>
                  <button
                    style={styles.buttonPrimary}
                    onClick={exportarRelatorioPDF}
                    disabled={!pdfPronto}
                  >
                    Gerar PDF
                  </button>
                </div>
              </div>

              <div ref={relatorioRef} style={styles.card}>
                <h3 style={styles.cardTitle}>
                  {tipoRelatorio === "produto"
                    ? "Relatório por produto"
                    : "Relatório geral do estoque"}
                </h3>

                {tipoRelatorio === "produto" ? (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Endereço</th>
                          <th style={styles.th}>Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioProduto.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={2}>
                              Sem dados para o produto selecionado.
                            </td>
                          </tr>
                        ) : (
                          relatorioProduto.map((r, i) => (
                            <tr key={`${r.endereco}-${i}`}>
                              <td style={styles.td}>{r.endereco}</td>
                              <td style={styles.td}>{r.quantidade}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Produto</th>
                          <th style={styles.th}>Endereço</th>
                          <th style={styles.th}>Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioGeral.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={3}>
                              Sem dados em estoque.
                            </td>
                          </tr>
                        ) : (
                          relatorioGeral.map((r, i) => (
                            <tr key={`${r.endereco}-${i}`}>
                              <td style={styles.td}>{r.produto}</td>
                              <td style={styles.td}>{r.endereco}</td>
                              <td style={styles.td}>{r.quantidade}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Consolidado por item</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Produto</th>
                        <th style={styles.th}>Curva</th>
                        <th style={styles.th}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidadoPorItem.map((item) => (
                        <tr key={item.produtoId}>
                          <td style={styles.td}>{item.produto}</td>
                          <td style={styles.td}>{item.curva}</td>
                          <td style={styles.td}>{item.saldo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {aba === "perfil" && (
            <div style={styles.sectionGap}>
              <h1 style={{ margin: 0 }}>Perfil</h1>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Dados do usuário</h3>
                <p>
                  <strong>Nome:</strong> {usuarioLogado.nome}
                </p>
                <p>
                  <strong>Login:</strong> {usuarioLogado.login}
                </p>
                <p>
                  <strong>Perfil:</strong> {usuarioLogado.perfil}
                </p>
                <p>
                  <strong>Status:</strong> {usuarioLogado.status}
                </p>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Alterar senha</h3>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Senha atual</label>
                    <input
                      type="password"
                      style={styles.input}
                      value={trocaSenha.atual}
                      onChange={(e) =>
                        setTrocaSenha({ ...trocaSenha, atual: e.target.value })
                      }
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Nova senha</label>
                    <input
                      type="password"
                      style={styles.input}
                      value={trocaSenha.nova}
                      onChange={(e) =>
                        setTrocaSenha({ ...trocaSenha, nova: e.target.value })
                      }
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Confirmar nova senha</label>
                    <input
                      type="password"
                      style={styles.input}
                      value={trocaSenha.confirmar}
                      onChange={(e) =>
                        setTrocaSenha({
                          ...trocaSenha,
                          confirmar: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <p style={styles.smallMuted}>{mensagemPerfil}</p>
                <button style={styles.buttonPrimary} onClick={alterarSenhaAtual}>
                  Salvar nova senha
                </button>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Log administrativo</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Usuário</th>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsAdmin.length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={4}>
                            Sem logs administrativos.
                          </td>
                        </tr>
                      ) : (
                        logsAdmin.map((log) => (
                          <tr key={log.id}>
                            <td style={styles.td}>{log.data}</td>
                            <td style={styles.td}>{log.usuario}</td>
                            <td style={styles.td}>{log.tipo}</td>
                            <td style={styles.td}>{log.detalhe}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Últimos 3 movimentos com exclusão</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Tipo</th>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Produto</th>
                        <th style={styles.th}>Endereço</th>
                        <th style={styles.th}>Qtd</th>
                        <th style={styles.th}>Usuário</th>
                        <th style={styles.th}>Obs</th>
                        <th style={styles.th}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimos3Movimentos.length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={8}>
                            Sem movimentos registrados.
                          </td>
                        </tr>
                      ) : (
                        ultimos3Movimentos.map((m) => linhaMovimento(m, true))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {confirmState.open && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <h3 style={{ marginTop: 0 }}>{confirmState.title}</h3>
            <p style={{ lineHeight: 1.5 }}>{confirmState.text}</p>
            <div
              style={{
                ...styles.lineActions,
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <button style={styles.buttonSecondary} onClick={fecharConfirmacao}>
                Cancelar
              </button>
              <button style={styles.buttonPrimary} onClick={executarConfirmacao}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.open && (
        <div
          style={{
            ...styles.toast,
            background:
              toast.type === "success"
                ? "#2e7d32"
                : toast.type === "error"
                ? "#c62828"
                : "#1565c0",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}