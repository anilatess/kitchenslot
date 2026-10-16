# Mutfak Slot

Pixi.js v8 ve Vite ile hazırlanmış 5x4 mutfak temalı slot oyunu. Oyun kuralları Pixi'den bağımsız saf JavaScript katmanındadır; tüm tur sonucu sunum başlamadan önce hesaplanır.

## Kurulum ve komutlar

```sh
npm install
npm run dev       # geliştirme sunucusu
npm run build     # dist/ üretim derlemesi
npm run preview   # üretim derlemesini yerel olarak önizle
npm test          # birim ve sunum testleri
npm run sim       # RTP simülasyonu (node sim/simulate.js [tur] [seed])
npm run sim:big   # 10 milyon turluk simülasyon
```

## Oynanış

- **SPIN** veya **Boşluk** ile döndür; `+` / `−` ile bahsi değiştir.
- **TURBO** animasyonları hızlandırır. Tercihler ve bakiye yerel tarayıcıda saklanır.
- Soldan başlayan en az üç makarada eşleşmeler ways-to-win ile kazanır. Kazanan semboller patlar, üsttekiler düşer ve yeni semboller gelir (tumble).
- Wild yalnızca 2–4. makaralarda çıkar. Scatter 3 veya daha fazla geldiğinde 10 bedava dönüş verir; bedava dönüşte tetiklenirse 5 dönüş ekler. Bedava dönüş çarpanları bonus boyunca birikir.
- Çarpanlar tumble zinciri bitince turun toplam kazancına uygulanır. Kazanç, bahis tutarının 1000 katıyla sınırlıdır.
- **BONUS AL (100x)** düğmesi, maliyeti onaylayınca bonus turunu satın alır. Bakiye yetersizse devre dışıdır.
- **AUTOPLAY**, 10/25/50/100 tur seçeneği sunar. Bonus tetiklenince, tek tur kazancı bahsin 50 katını aşınca veya bakiye bahse yetmeyince durur; **DURDUR** devam eden turu bitirip yeni turu başlatmaz.
- Bakiye bittiğinde **Bakiyeyi sıfırla** görünür. **?** ödeme tablosu ve kuralları açar.
- Büyük kazanç kutlamaları 10x'te BIG, 25x'te MEGA ve 50x'te SUPER olarak gösterilir. Bahisten küçük kazançta kutlama gösterilmez.

## Ses ve görseller

Sesler `src/audio/AudioManager.js` içindeki WebAudio osilatörleriyle koddan üretilir; harici ses dosyası veya üçüncü taraf kaynak kullanılmaz. Tarayıcıların otomatik oynatma kısıtına uymak için ses ilk kullanıcı etkileşiminden sonra başlar. Ses tercihi diğer oyun tercihleriyle birlikte saklanır.

Semboller varsayılan olarak emoji ve çizilmiş karolarla gösterilir. İsteğe bağlı atlas, `public/assets/symbols.json` konumunda Pixi spritesheet JSON'u ve aynı klasörde kare görselleri olarak sağlanabilir. Tanınan kare adları: `tomato`, `garlic`, `pepper`, `carrot`, `dumpling`, `sushi`, `steak`, `onion`, `mushroom`, `chef`, `pot`, `multiplier` (uzantılı veya uzantısız). Atlas açılışta `Assets.load` ile yüklenir; dosya veya kare yoksa ilgili sembol emoji görünümüne düşer. Atlas olmadığı durumda da oyun normal açılır.

## Mimari

Bağımlılık yönü `game` ← `presenter` ← `view` şeklindedir. `game/` Pixi'yi içe aktarmaz; simülasyon ve testler motoru doğrudan kullanır.

```text
src/
  game/       Saf oyun kuralları: config.js, engine.js, rng.js
  core/       Game birleştiricisi, GameState, responsive düzen ve sabitler
  animation/  Promise tabanlı tween ve easing
  presenter/  RoundPlayer tur sonucunu sahnede sıralı oynatır
  view/       Grid, semboller, HUD, ödeme/kurallar ekranı ve skins.js
  audio/      WebAudio tabanlı AudioManager
sim/          RTP simülasyonu ve ödeme tablosu çıktısı
test/         Motor, durum, animasyon ve sunum testleri
```

Akış: `Game.#spin → engine.playRound(record) → RoundPlayer.play → GridView/Hud animasyonları`. Motor `steps[]` içindeki ızgara, kaldırılan/toplanan hücreler ve kazançları önceden hesaplar; sunum katmanı kural kararı vermez. Sembol görünümünü değiştirmek için `src/view/skins.js` içindeki `createSymbolSkin(cell)` kullanılır.

## Matematik

Varsayılan ayarlar için referans 5 milyon turluk simülasyon: RTP yaklaşık %95–96, kazanma sıklığı yaklaşık %55, bonus sıklığı yaklaşık 1/175, bonus satın alma RTP'si yaklaşık %96. Ayarlar `src/game/config.js` içindedir (`WEIGHTS`, `PAY_SCALE`, `MULTS`); matematiği değiştirince `npm run sim` ile yeniden ölçün.

## GitHub Pages yayını

`.github/workflows/deploy.yml`, `main` dalına gönderimde ve elle başlatıldığında testleri, üretim derlemesini ve Pages yayımını çalıştırır. Depo ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir. Vite `base: './'` ile derleme dosyalarına göreli yollar kullanır; bu, depo alt yolu üzerinden sunulan Pages sitelerinde de çalışır.
