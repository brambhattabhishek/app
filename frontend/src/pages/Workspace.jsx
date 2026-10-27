import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, CloudUpload, RotateCcw, Loader2, Code2, LogIn, AlertCircle } from "lucide-react";
import { api, errMsg, LANGS } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeftPanel from "@/components/workspace/LeftPanel";
import ConsolePanel from "@/components/workspace/ConsolePanel";

const key = (slug, lang) => `cl_code:${slug}:${lang}`;

// Safe language resolution (handles stale localStorage "cl_lang" values)
const resolveLang = (raw) => (LANGS.some((l) => l.id === raw) ? raw : "python");

// Safe boilerplate lookup — falls back to first available language if missing
const boilerplateFor = (problem, lang) => {
  if (!problem?.boilerplates) return "";
  return problem.boilerplates[lang] ?? problem.boilerplates.python ?? "";
};

export default function Workspace() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();

  const [lang, setLang] = useState(() => resolveLang(localStorage.getItem("cl_lang")));
  const [code, setCode] = useState("");
  const [cases, setCases] = useState([]);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("testcase");
  const [leftTab, setLeftTab] = useState("description");
  const [busy, setBusy] = useState(null); // null | "run" | "submit"
  const [subsKey, setSubsKey] = useState(0);

  const isGuest = !user;

  // ═══════════════════════════════════════════════════════════
  // Problem detail query — cached
  // ═══════════════════════════════════════════════════════════
  const {
    data: p,
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: ["problem", slug],
    queryFn: async () => (await api.get(`/problems/${slug}`)).data,
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // Reset transient state when switching problems
  useEffect(() => {
    setResult(null);
    setTab("testcase");
    setLeftTab("description");
    setBusy(null);
  }, [slug]);

  // Initialize test cases from sample tests
  useEffect(() => {
    if (Array.isArray(p?.sampleTests)) {
      setCases(
          p.sampleTests.map((t) =>
              typeof t?.input === "string" ? t.input.split("\n") : [""]
          )
      );
    } else {
      setCases([]);
    }
  }, [p]);

  // Load / persist code per (slug, lang)
  useEffect(() => {
    if (!p) return;
    const stored = localStorage.getItem(key(slug, lang));
    setCode(stored != null ? stored : boilerplateFor(p, lang));
    localStorage.setItem("cl_lang", lang);
  }, [p, lang, slug]);

  // Surface fetch errors
  useEffect(() => {
    if (queryError) toast.error(errMsg(queryError));
  }, [queryError]);

  const onCode = useCallback(
      (v = "") => {
        setCode(v);
        localStorage.setItem(key(slug, lang), v);
      },
      [slug, lang]
  );

  const reset = useCallback(() => {
    if (!p) return;
    localStorage.removeItem(key(slug, lang));
    setCode(boilerplateFor(p, lang));
    toast("Code reset to default template");
  }, [p, lang, slug]);

  const onLangChange = useCallback((newLang) => {
    const safe = resolveLang(newLang);
    setLang(safe);
    localStorage.setItem("cl_lang", safe);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RUN — allowed for guests AND logged-in users
  // ═══════════════════════════════════════════════════════════
  const run = useCallback(async () => {
    if (!p) return;
    if (!code || !code.trim()) {
      toast.error("Please write some code before running");
      return;
    }
    setBusy("run");
    setTab("result");
    setResult(null);
    try {
      const { data } = await api.post("/run", {
        slug,
        language: lang,
        code,
        inputs: cases.map((c) => c.join("\n")),
      });
      setResult({ kind: "run", ...data });
    } catch (e) {
      toast.error(errMsg(e));
      setTab("testcase");
    } finally {
      setBusy(null);
    }
  }, [p, slug, lang, code, cases]);

  // ═══════════════════════════════════════════════════════════
  // SUBMIT — login required
  // ═══════════════════════════════════════════════════════════
  const submit = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to submit your solution", {
        action: {
          label: "Sign in",
          onClick: () =>
              navigate("/login", { state: { from: `/problems/${slug}` } }),
        },
      });
      navigate("/login", { state: { from: `/problems/${slug}` } });
      return;
    }
    if (!code || !code.trim()) {
      toast.error("Please write some code before submitting");
      return;
    }
    setBusy("submit");
    setTab("result");
    setResult(null);
    try {
      const { data } = await api.post("/submit", { slug, language: lang, code });
      setResult({ kind: "submit", ...data });
      setSubsKey((k) => k + 1);

      if (data.status === "Accepted") {
        toast.success("Accepted! Nice work.");
      } else if (data.status) {
        toast.error(data.status);
      }

      if (data.daily) {
        toast.success(
            `Daily challenge complete! ${data.daily.streak}-day streak · +${data.daily.coins_earned} coins${
                data.daily.badge ? ` · Badge: ${data.daily.badge}` : ""
            }`
        );
      }

      // Refresh any affected cache
      [
        ["problems"],
        ["profile"],
        ["daily"],
        ["recommendations"],
        ["companies"],
        ["company"],
        ["problem", slug],
        ["submissions", slug],
      ].forEach((qk) => queryClient.invalidateQueries({ queryKey: qk }));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, [user, slug, lang, code, navigate, queryClient]);

  const loadSubmission = useCallback(
      (s) => {
        if (!s?.language || !s?.code) return;
        const safeLang = resolveLang(s.language);
        setLang(safeLang);
        localStorage.setItem(key(slug, safeLang), s.code);
        setCode(s.code);
        toast("Loaded submission into editor");
      },
      [slug]
  );

  // ═══════════════════════════════════════════════════════════
  // Loading / error states
  // ═══════════════════════════════════════════════════════════
  if (isLoading && !p) {
    return (
        <div className="h-[calc(100vh-48px)] grid place-items-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
    );
  }

  if (isError || (!isLoading && !p)) {
    return (
        <div className="h-[calc(100vh-48px)] grid place-items-center text-center px-4">
          <div>
            <AlertCircle className="w-8 h-8 text-hard mx-auto mb-3" />
            <p className="text-sm text-hard mb-1">Problem not found</p>
            <p className="text-xs text-muted-foreground mb-4">
              {queryError ? errMsg(queryError) : "This problem may have been removed."}
            </p>
            <button
                onClick={() => navigate("/")}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              Back to problems
            </button>
          </div>
        </div>
    );
  }

  // Lang might have been resolved mid-flight; guard for missing boilerplate key
  const monacoLang = LANGS.find((l) => l.id === lang)?.monaco ?? "python";

  return (
      <div
          className="relative z-10 h-[calc(100vh-48px)] flex flex-col p-2 gap-2"
          data-testid="problem-workspace"
      >
        {/* ═══ Guest banner ═══ */}
        {isGuest && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-[11px] sm:text-xs">
              <LogIn className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">
                        <strong className="text-foreground">Guest mode:</strong> Run is free.
                        Sign in to submit and save your progress.
                    </span>
              <button
                  onClick={() =>
                      navigate("/login", { state: { from: `/problems/${slug}` } })
                  }
                  className="ml-auto shrink-0 text-primary font-semibold hover:underline"
              >
                Sign in
              </button>
            </div>
        )}

        {/* ═══ Action bar ═══ */}
        <div className="flex items-center justify-center gap-2">
          <button
              onClick={run}
              disabled={!!busy}
              data-testid="editor-run-button"
              className="h-8 px-4 rounded-md bg-secondary hover:bg-accent text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            {busy === "run" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Play className="w-4 h-4" />
            )}
            Run
          </button>
          <button
              onClick={submit}
              disabled={!!busy}
              data-testid="editor-submit-button"
              title={isGuest ? "Sign in to submit" : "Submit solution"}
              className={`h-8 px-4 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-60 ${
                  isGuest
                      ? "bg-secondary text-muted-foreground hover:bg-accent"
                      : "bg-easy/15 text-easy hover:bg-easy/25"
              }`}
          >
            {busy === "submit" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isGuest ? (
                <LogIn className="w-4 h-4" />
            ) : (
                <CloudUpload className="w-4 h-4" />
            )}
            {isGuest ? "Sign in to Submit" : "Submit"}
          </button>
        </div>

        {/* ═══ Editor + panel split ═══ */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={45} minSize={25}>
            <LeftPanel
                p={p}
                tab={leftTab}
                setTab={setLeftTab}
                refreshKey={subsKey}
                onLoad={loadSubmission}
            />
          </ResizablePanel>

          <ResizableHandle className="w-2 bg-transparent hover:bg-primary/40 transition-colors" />

          <ResizablePanel defaultSize={55} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={62} minSize={20}>
                <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
                  <div className="h-10 flex items-center gap-2 px-2 border-b bg-secondary/50">
                                    <span className="flex items-center gap-1.5 text-sm font-semibold px-2">
                                        <Code2 className="w-4 h-4 text-easy" />
                                        Code
                                    </span>
                    <Select value={lang} onValueChange={onLangChange}>
                      <SelectTrigger
                          className="h-7 w-32 text-xs border-none bg-transparent hover:bg-background"
                          data-testid="editor-language-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGS.map((l) => (
                            <SelectItem
                                key={l.id}
                                value={l.id}
                                data-testid={`language-option-${l.id}`}
                            >
                              {l.label}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                        onClick={reset}
                        data-testid="editor-reset-button"
                        title="Reset to default code"
                        className="ml-auto w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0" data-testid="monaco-code-editor">
                    <Editor
                        language={monacoLang}
                        value={code}
                        onChange={onCode}
                        theme={resolvedTheme === "light" ? "light" : "vs-dark"}
                        options={{
                          fontSize: 14,
                          fontFamily: "JetBrains Mono, monospace",
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 4,
                          padding: { top: 12 },
                          wordWrap: "on",
                          smoothScrolling: true,
                        }}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-2 bg-transparent hover:bg-primary/40 transition-colors" />

              <ResizablePanel defaultSize={38} minSize={12}>
                <ConsolePanel
                    p={p}
                    cases={cases}
                    setCases={setCases}
                    result={result}
                    tab={tab}
                    setTab={setTab}
                    busy={busy}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
  );
}