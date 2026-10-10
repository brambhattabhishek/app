import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Play, CloudUpload, RotateCcw, Loader2, Code2 } from "lucide-react";
import { api, errMsg, LANGS } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeftPanel from "@/components/workspace/LeftPanel";
import ConsolePanel from "@/components/workspace/ConsolePanel";

const key = (slug, lang) => `cl_code:${slug}:${lang}`;

export default function Workspace() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [p, setP] = useState(null);
  const [lang, setLang] = useState(localStorage.getItem("cl_lang") || "python");
  const [code, setCode] = useState("");
  const [cases, setCases] = useState([]);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("testcase");
  const [leftTab, setLeftTab] = useState("description");
  const [busy, setBusy] = useState(null);
  const [subsKey, setSubsKey] = useState(0);

  useEffect(() => {
    setP(null); setResult(null);
    api.get(`/problems/${slug}`)
      .then(({ data }) => { setP(data); setCases(data.sampleTests.map((t) => t.input.split("\n"))); })
      .catch((e) => toast.error(errMsg(e)));
  }, [slug]);

  useEffect(() => {
    if (!p) return;
    setCode(localStorage.getItem(key(slug, lang)) ?? p.boilerplates[lang]);
    localStorage.setItem("cl_lang", lang);
  }, [p, lang, slug]);

  const onCode = (v = "") => { setCode(v); localStorage.setItem(key(slug, lang), v); };
  const reset = () => { localStorage.removeItem(key(slug, lang)); setCode(p.boilerplates[lang]); toast("Code reset to default template"); };

  const run = useCallback(async () => {
    setBusy("run"); setTab("result");
    try {
      const { data } = await api.post("/run", { slug, language: lang, code, inputs: cases.map((c) => c.join("\n")) });
      setResult({ kind: "run", ...data });
    } catch (e) { toast.error(errMsg(e)); setTab("testcase"); } finally { setBusy(null); }
  }, [slug, lang, code, cases]);

  const submit = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to submit your solution");
      navigate("/login", { state: { from: `/problems/${slug}` } });
      return;
    }
    setBusy("submit"); setTab("result");
    try {
      const { data } = await api.post("/submit", { slug, language: lang, code });
      setResult({ kind: "submit", ...data });
      setSubsKey((k) => k + 1);
      data.status === "Accepted" ? toast.success("Accepted! Nice work.") : toast.error(data.status);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }, [user, slug, lang, code, navigate]);

  const loadSubmission = (s) => { setLang(s.language); setTimeout(() => onCode(s.code), 0); toast("Loaded submission into editor"); };

  if (!p) return <div className="h-[calc(100vh-48px)] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="relative z-10 h-[calc(100vh-48px)] flex flex-col p-2 gap-2" data-testid="problem-workspace">
      <div className="flex items-center justify-center gap-2">
        <button onClick={run} disabled={!!busy} data-testid="editor-run-button"
          className="h-8 px-4 rounded-md bg-secondary hover:bg-accent text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60">
          {busy === "run" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run
        </button>
        <button onClick={submit} disabled={!!busy} data-testid="editor-submit-button"
          className="h-8 px-4 rounded-md bg-easy/15 text-easy hover:bg-easy/25 text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60">
          {busy === "submit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />} Submit
        </button>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={45} minSize={25}>
          <LeftPanel p={p} tab={leftTab} setTab={setLeftTab} refreshKey={subsKey} onLoad={loadSubmission} />
        </ResizablePanel>
        <ResizableHandle className="w-2 bg-transparent hover:bg-primary/40 transition-colors" />
        <ResizablePanel defaultSize={55} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={62} minSize={20}>
              <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
                <div className="h-10 flex items-center gap-2 px-2 border-b bg-secondary/50">
                  <span className="flex items-center gap-1.5 text-sm font-semibold px-2"><Code2 className="w-4 h-4 text-easy" />Code</span>
                  <Select value={lang} onValueChange={setLang}>
                    <SelectTrigger className="h-7 w-32 text-xs border-none bg-transparent hover:bg-background" data-testid="editor-language-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{LANGS.map((l) => <SelectItem key={l.id} value={l.id} data-testid={`language-option-${l.id}`}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <button onClick={reset} data-testid="editor-reset-button" title="Reset to default code" className="ml-auto w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex-1 min-h-0" data-testid="monaco-code-editor">
                  <Editor language={LANGS.find((l) => l.id === lang).monaco} value={code} onChange={onCode}
                    theme={resolvedTheme === "light" ? "light" : "vs-dark"}
                    options={{ fontSize: 14, fontFamily: "JetBrains Mono, monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, padding: { top: 12 } }} />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle className="h-2 bg-transparent hover:bg-primary/40 transition-colors" />
            <ResizablePanel defaultSize={38} minSize={12}>
              <ConsolePanel p={p} cases={cases} setCases={setCases} result={result} tab={tab} setTab={setTab} busy={busy} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
