/* Tweaks island — applies visual-style variations to the vanilla site.
   Renders the TweaksPanel from tweaks-panel.jsx into #tweaks-root. */
const { useEffect } = React;

const FA_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "imperio",
  "accent": "#f5c518",
  "titleFont": "Anton",
  "starDensity": "normal",
  "maxw": 1180
}/*EDITMODE-END*/;

function ForcaTweaks() {
  const [t, setTweak] = useTweaks(FA_DEFAULTS);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = t.theme;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty(
      '--font-display',
      t.titleFont === 'Oswald' ? "'Oswald', sans-serif" : "'Anton', 'Oswald', sans-serif"
    );
    root.style.setProperty('--maxw', t.maxw + 'px');
    root.dataset.stars = t.starDensity;
    window.dispatchEvent(new CustomEvent('fa-stars-change'));
  }, [t.theme, t.accent, t.titleFont, t.maxw, t.starDensity]);

  return (
    <TweaksPanel title="Força Ágil · Estilo">
      <TweakSection label="Direção visual" />
      <TweakRadio
        label="Tema"
        value={t.theme}
        options={[{ value: "imperio", label: "Império" }, { value: "resistencia", label: "Rebelião" }, { value: "holocron", label: "Holocron" }]}
        onChange={(v) => {
          const map = { imperio: "#f5c518", resistencia: "#57d3ff", holocron: "#f5c518" };
          setTweak({ theme: v, accent: map[v] || t.accent });
        }}
      />
      <TweakColor
        label="Cor de destaque"
        value={t.accent}
        options={["#f5c518", "#57d3ff", "#2e86e6", "#ff3b30"]}
        onChange={(v) => setTweak('accent', v)}
      />
      <TweakSection label="Tipografia & layout" />
      <TweakRadio
        label="Fonte dos títulos"
        value={t.titleFont}
        options={["Anton", "Oswald"]}
        onChange={(v) => setTweak('titleFont', v)}
      />
      <TweakSlider
        label="Largura do conteúdo"
        value={t.maxw} min={1040} max={1320} step={20} unit="px"
        onChange={(v) => setTweak('maxw', v)}
      />
      <TweakSection label="Atmosfera" />
      <TweakRadio
        label="Densidade de estrelas"
        value={t.starDensity}
        options={["calmo", "normal", "denso"]}
        onChange={(v) => setTweak('starDensity', v)}
      />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<ForcaTweaks />);
