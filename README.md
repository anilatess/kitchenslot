# Mutfak Slot

Pixi.js v8 ve Vite ile hazırlanmış 5x4 mutfak temalı slot oyunu. Oyun kuralları Pixi'den bağımsız saf JavaScript katmanındadır; tüm tur sonucu sunum başlamadan önce hesaplanır.

## Görsel güncelleme · 16 Ekim 2026

Kullanıcının PNG sembolleri, gerçekçi mutfak arka planı, tencere karıştıran şef ve koyu yeşil/şampanya arayüz kullanılır. Eski tarif panosu kaldırıldı. Mobil bahis, bonus, otomatik oyun ve onay düğmelerinin dokunma alanları büyütüldü.

Açılışta gösterilen semboller dekoratif bir vitrindir: bahis alınmaz, RNG tüketilmez ve kazanç hesaplanmaz. İlk gerçek dönüş bu vitrini değiştirir. Sembollerde katmanlı karolar, inişte esneme, kazananlarda genişleyen halkalar ve SPIN düğmesinde yavaş parıltı bulunur. Görsel güncelleme motoru, ödeme tablolarını, RTP ayarlarını veya bonus kurallarını değiştirmez.

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
- Büyük kazanç kutlamaları 10x'te BÜYÜK, 25x'te MUHTEŞEM ve 50x'te OLAĞANÜSTÜ KAZANÇ olarak gösterilir. Bahisten küçük kazançta kutlama gösterilmez.
- Bonus girişi ve ek dönüşler ayrı sunulur. Bonus sonunda toplam tur kazancı, oynanan bedava dönüş sayısı ve biriken çarpan gösterilir; DEVAM ET veya Escape ile oyuna dönülür.
- Sayfa yenilendiğinde kayıtlı tur ikinci bahis kesilmeden, son tamamlanan dönüşten devam eder. Kesilen dönüş aynı kayıtla yeniden gösterilir. Resmi ödeme yalnızca bir kez bakiyeye eklenir.
- Tur sonucu kaydedilemiyorsa yeni bahis kesilmez. Animasyon hata verse de kayıtlı resmi ödeme korunur; kayıt güncellenemiyorsa tekrar deneme ekranı açılır. Kalıcılık bu tarayıcı ve site adresindeki yerel depolamaya bağlıdır.

## Yeni PNG semboller ve gerçekçi arka plan

Kullanıcının sembolleri public/assets/symbols/ altında kullanılır. Dosyalar İngilizce sabit adlarla eşleştirilir; kaynak sembol-png klasörü değiştirilmez. PNG yüklenemezse ilgili sembol eski atlas/emoji görünümüne döner. Çarpan değerleri görselin üstüne canlı yazılır; sabit x5 resmi kullanılmaz.

public/assets/kitchen-realistic.png gerçekçi mutfak sahnesidir. Arka plan ekranı kaplar; oyun sahnesi saydamdır. Görsel yüklenmezse çizilmiş fayans/ahşap arka plan kullanılır. Oyun matematiği değişmez.

## Ses ve görseller

Sesler `src/audio/AudioManager.js` içindeki WebAudio osilatörleriyle koddan üretilir; harici ses dosyası veya üçüncü taraf kaynak kullanılmaz. Tarayıcıların otomatik oynatma kısıtına uymak için ses ilk kullanıcı etkileşiminden sonra başlar. Ses tercihi diğer oyun tercihleriyle birlikte saklanır.

Semboller varsayılan olarak kullanıcının PNG setiyle gösterilir; PNG bulunamazsa atlas, o da yoksa emoji ve çizilmiş karo görünümü kullanılır. İsteğe bağlı atlas, `public/assets/symbols.json` konumunda Pixi spritesheet JSON'u ve aynı klasörde kare görselleri olarak sağlanabilir. Tanınan kare adları: `tomato`, `garlic`, `pepper`, `carrot`, `dumpling`, `sushi`, `steak`, `onion`, `mushroom`, `chef`, `pot`, `multiplier` (uzantılı veya uzantısız). Atlas açılışta `Assets.load` ile yüklenir; dosya veya kare yoksa ilgili sembol emoji görünümüne düşer. Atlas olmadığı durumda da oyun normal açılır.

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

Akış: `Game.#spin → engine.playRound(record) → GameState.beginRound → RoundPlayer.play → GameState.settleRound`. Sonuç ve bahis kesintisi tek yerel kayıtla saklanır; her tamamlanan dönüş checkpoint oluşturur. Ödeme, animasyonun dönüş değerinden değil kayıtlı resmi toplamdan alınır. Motor `steps[]` içindeki ızgara, kaldırılan/toplanan hücreler ve kazançları önceden hesaplar; sunum katmanı kural kararı vermez. Sembol görünümünü değiştirmek için `src/view/skins.js` içindeki `createSymbolSkin(cell)` kullanılır.

## Matematik

Ödemeler `src/game/config.js` içindeki `PAY_TABLES.base` ve `PAY_TABLES.free` tablolarında doğrudan bahis katı olarak tanımlanır. `getSymbolPays(symbol, mode)` hem motorun hem ödeme ekranının tek kaynağıdır. Oranlar iki ondalık basamağa sadeleştirilmiştir; eski `/1000` ve `9.6/8.6` ölçekleri uygulanmaz. `PAY` ana oyun tablosunun uyumluluk adıdır; `PAY_SCALE` yalnızca etkisiz `1/1` uyumluluk değeridir. Önceki `PSBASE/PSFREE` ortam değişkenleri kullanılmaz. Sembol ağırlıkları ve çarpan dağılımları `WEIGHTS`/`MULTS` içinde kalır.

Örnek: ana oyunda domatesin 3/4/5 makara oranları `0.01 / 0.03 / 0.09`; bedava dönüşte `0.01 / 0.03 / 0.08`. 100 bahis ve tek kazanan yol için bunlar sırasıyla `1 / 3 / 9` ve `1 / 3 / 8` ödeme verir. Yol sayısı ve toplanan çarpan ayrıca uygulanır. Ödeme ekranındaki iki sekme gerçek tabloları gösterir.

Sadeleştirme öncesi/sonrası eşleştirilmiş kontrol: aynı tur tohumlarıyla 500.000 normal turda örneklem RTP'si %97.1914 → %97.0999 (−0.0915 yüzde puanı); 30.000 bonus alımında %96.9786 → %96.2742 (−0.7044 puan). Mutlak normal örneklem RTP'sinin yaklaşık %95 belirsizliği ±3.22 puandır; bu sonuç kesin/teorik RTP değildir. Önceki 5 milyon turluk %95–96 referansı eski tabloya aittir. Yeni matematiği değerlendirirken `npm run sim` ile daha büyük örneklem kullanın. Devam eden eski turlar yeni oranlarla yeniden hesaplanmaz; kayıtlı ödeme bir kez korunur.

## GitHub Pages yayını

`.github/workflows/deploy.yml`, `main` dalına gönderimde ve elle başlatıldığında testleri, üretim derlemesini ve Pages yayımını çalıştırır. Depo ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçilmelidir. Vite `base: './'` ile derleme dosyalarına göreli yollar kullanır; bu, depo alt yolu üzerinden sunulan Pages sitelerinde de çalışır.

## Şef ve bonus tenceresi

Soldaki şef sekiz karelik bir karıştırma döngüsü oynatır. Bedava dönüşlerde toplanan çarpanlar tencereye uçar; tencerenin altındaki ateş, parıltı ve kıvılcımlar birikimli toplamla güçlenir. Sayı, RoundPlayer tarafından motorun kaydettiği freeMult/collected verilerinden gösterilir; yeni ödeme veya çarpan kuralı eklenmez. Ana oyun çarpanı sağdaki eski göstergede kalır. Bonus sonunda son toplam görünür; yeni turda sıfırlanır. Telefon görünümünde şef, kontrollerin altında küçük bir sahne olarak yer alır.

Varlıklar public/assets/chef/ altında; istem ve üretim notları SEF_ANIMASYON_NOTLARI.md içinde. Hareketi azaltma tercihi açıksa animasyon ve hareketli efektler sakinleşir. Sprite yüklenemezse emoji yedeği gösterilir; tencere sayacı çalışır.

## Son doğrulama

Sade oranlar güncellemesinin tam test paketi: 86/86 başarılı, 0 hata/atlama. Üretim derlemesi başarılı. Gerçek tarayıcıda 1280×720 ve 390×844 ödeme sekmeleri ve doğru oranlar kontrol edildi; tarayıcı hata/uyarı günlüğü boş. Önceki ödeme kaydının yeni sürümde aynı tutarla ve yalnız bir kez tamamlandığı ayrıca doğrulandı. Bu güncellemede ödeme tabloları değiştirildi; RNG, sembol ağırlıkları ve bonus kuralları korundu. Matematik karşılaştırması ORAN_NOTLARI.md, güncel doğrulama DOGRULAMA_SADE_ORANLAR.txt içindedir. DOGRULAMA_KALITE.txt önceki görsel sürümün sonuçlarını saklar.
