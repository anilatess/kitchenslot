# Mutfak Slot

Pixi.js (v8) + Vite ile yapılmış 5x4 slot oyunu: ways-to-win, tumble, Wild / Scatter / Çarpan,
bedava dönüş ve bonus satın alma mantığı. Semboller şimdilik emoji (geçici), ileride sprite atlas.

    npm install
    npm run dev       # geliştirme sunucusu
    npm run build     # üretim derlemesi (dist/)
    npm test          # birim + sunum testleri
    npm run sim       # RTP simülasyonu (node sim/simulate.js [tur] [seed])

Oynarken: **Boşluk** veya SPIN ile çevir, ± ile bahis, TURBO ile hızlandır.

## Mimari

Üç katman, tek yönlü bağımlılık: `game` (kural) ← `presenter` (sıra) ← `view` (çizim).
`game/` Pixi'yi hiç bilmez; simülasyon ve testler onu doğrudan kullanır.

    src/
      game/         KURALLAR (saf JS, Pixi yok)
        config.js     semboller, ödeme tablosu, ağırlıklar, çarpanlar, kurallar
        engine.js     playRound / playSpin: sonucu ve tumble adımlarını üretir
        rng.js        tohumlanabilir RNG
      core/         UYGULAMA İSKELETİ
        Game.js           parçaları kurar ve birbirine bağlar
        GameState.js      bakiye, bahis, turbo, meşgul (olay yayar)
        ResponsiveRoot.js yatay/dikey düzen + ekrana sığdırma
        constants.js      boyutlar, süreler, renkler
        Emitter.js
      animation/    ZAMANLAMA
        Animator.js   Promise tabanlı tween (await ile sıralanır), turbo hızı
        easing.js
      presenter/    SAHNE AKIŞI
        RoundPlayer.js  motorun turunu sırayla oynatır (düş, patlat, çarpan, bedava dönüş)
      view/         ÇİZİM
        GridView.js   5x4 ızgara: dropIn / playStep / collectCells
        SymbolView.js tek sembol
        skins.js      SEMBOL GÖRSELLERİ - atlas'a geçişte değişecek tek dosya
        Hud.js, Button.js, Readout.js

    sim/            RTP simülasyonu ve ödeme tablosu çıktısı
    test/           motor, animator, durum ve sunum testleri

### Akış

    Game.#spin -> engine.playRound(record) -> RoundPlayer.play -> GridView/Hud animasyonları

Motor tüm sonucu önceden hesaplar (`steps[]`: grid, removed, collected, nextGrid, stepWin);
sunum katmanı bunu oynatır, hiçbir kural kararı vermez. Sonucu sunucudan almak istersen
yalnızca `Game.#spin` içindeki `playRound` çağrısı değişir.

### Sprite atlas'a geçiş
`src/view/skins.js` içindeki `createSymbolSkin(cell)` fonksiyonu `Sprite` döndürsün, gerisi aynı kalır.

## Matematik (varsayılan ayarlar, 5M tur simülasyonu)
RTP ~%95-96 | kazanç sıklığı ~%55 | bonus 1/175 | bonus satın alma (100x) RTP ~%96 | tavan 1000x.
Ayar noktaları: `config.js` (ağırlıklar, `PAY_SCALE`, `MULTS`). Değiştirince `npm run sim` ile ölç.

## Henüz yok
Autoplay, ses efektleri, bonus satın alma düğmesi (motor hazır), sprite atlas.
