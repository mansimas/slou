/**
 * Catalog
 * (sails.config.catalog)
 *
 * Static product catalog for the SLOU storefront, recovered from the site's
 * llms.txt (slou.lt). Localized into all supported languages
 * (lt, en, pt, fr, de, es, it). Slug is shared; localized fields (name,
 * category, short, long) and size live under `t.<locale>` / `size.<locale>`.
 * Images: assets/images/products/<slug>.jpg
 *
 * `price` is a number in EUR, or null when it has not been set yet (those
 * render as the placeholder '€00'). `discount` is an optional percentage off;
 * the struck-through original, the badge and the final price are all derived
 * from these two in PagesController, so the arithmetic lives in one place.
 *
 * `video` (optional) names a file in the `videos/` folder at the project
 * root, served at /videos/<file> (see config/http.js). The six products
 * that have one are featured in the homepage video row.
 */

module.exports.catalog = {

  products: [

    {
      slug: 'mini-rankine-vesa',
      price: 1099,
      discount: 30,
      video: 'mini_rankine.mp4',
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Mini Bag', category: 'Rankinės', short: 'Minimalistinė rankinė kasdienai. Reguliuojamo ilgio dirželis.', long: 'Minimalistinė rankinė kasdienai, pagaminta iš natūralios, augalinio rauginimo odos. Tvirta, bet lengva – telpa svarbiausi daiktai: telefonas, piniginė, raktai. Pagaminta rankomis. Be pamušalo, dirželis reguliuojamo ilgio. Uždarymas – metalinis spaustukas.' },
        en: { name: 'Mini Bag', category: 'Bags', short: 'A minimalist everyday bag. Adjustable-length strap.', long: 'A minimalist everyday bag made of natural, vegetable-tanned leather. Sturdy yet light — fits the essentials: phone, wallet, keys. Handmade. Unlined, adjustable-length strap. Metal snap closure.' },
        pt: { name: 'Mini Bag', category: 'Bolsas', short: 'Uma bolsa minimalista para o dia a dia. Alça de comprimento ajustável.', long: 'Uma bolsa minimalista para o dia a dia, feita em couro natural de curtimento vegetal. Resistente mas leve — cabem os essenciais: telemóvel, carteira, chaves. Feita à mão. Sem forro, alça de comprimento ajustável. Fecho de mola metálico.' },
        fr: { name: 'Mini Bag', category: 'Sacs', short: 'Un sac minimaliste pour tous les jours. Bandoulière de longueur réglable.', long: 'Un sac minimaliste pour tous les jours, en cuir naturel à tannage végétal. Robuste mais léger — il contient l’essentiel : téléphone, portefeuille, clés. Fait main. Sans doublure, bandoulière de longueur réglable. Fermeture à bouton-pression métallique.' },
        de: { name: 'Mini Bag', category: 'Taschen', short: 'Eine minimalistische Alltagstasche. Längenverstellbarer Riemen.', long: 'Eine minimalistische Alltagstasche aus natürlichem, pflanzlich gegerbtem Leder. Robust und doch leicht — für das Wesentliche: Telefon, Geldbörse, Schlüssel. Handgefertigt. Ungefüttert, längenverstellbarer Riemen. Metall-Druckknopfverschluss.' },
        es: { name: 'Mini Bag', category: 'Bolsos', short: 'Un bolso minimalista para el día a día. Correa de longitud ajustable.', long: 'Un bolso minimalista para el día a día, hecho de cuero natural de curtido vegetal. Resistente pero ligero: caben lo esencial: teléfono, cartera, llaves. Hecho a mano. Sin forro, correa de longitud ajustable. Cierre de botón a presión metálico.' },
        it: { name: 'Mini Bag', category: 'Borse', short: 'Una borsa minimalista per tutti i giorni. Tracolla di lunghezza regolabile.', long: 'Una borsa minimalista per tutti i giorni, in cuoio naturale a concia vegetale. Resistente ma leggera — contiene l’essenziale: telefono, portafoglio, chiavi. Fatta a mano. Senza fodera, tracolla di lunghezza regolabile. Chiusura a bottone automatico in metallo.' }
      }
    },

    {
      slug: 'dirzas',
      price: 420,
      discount: 40,
      video: 'dirzas.mp4',
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Diržas', category: 'Aksesuarai', short: 'Diržas iš augalinio rauginimo odos. Rankomis apdailinti kraštai.', long: 'Diržas pagamintas iš storos, natūralios augalinio rauginimo odos. Kraštai apdailinti rankomis, sagtis – metalinė. Laikui bėgant oda tamsėja ir įgauna savitą patiną. Gaminama po užsakymo, pagal jūsų juosmens apimtį.' },
        en: { name: 'Belt', category: 'Accessories', short: 'A belt in vegetable-tanned leather. Hand-finished edges.', long: 'This belt is made of thick, natural vegetable-tanned leather. The edges are finished by hand and the buckle is metal. Over time the leather darkens and gains a patina of its own. Made to order, to your waist measurement.' },
        pt: { name: 'Cinto', category: 'Acessórios', short: 'Um cinto em couro de curtimento vegetal. Bordas acabadas à mão.', long: 'Este cinto é feito em couro natural de curtimento vegetal espesso. As bordas são acabadas à mão e a fivela é de metal. Com o tempo, o couro escurece e ganha uma pátina própria. Feito por encomenda, à medida da sua cintura.' },
        fr: { name: 'Ceinture', category: 'Accessoires', short: 'Une ceinture en cuir à tannage végétal. Bords finis à la main.', long: 'Cette ceinture est fabriquée en cuir naturel à tannage végétal épais. Les bords sont finis à la main et la boucle est en métal. Avec le temps, le cuir fonce et acquiert sa propre patine. Fabriquée sur commande, à votre tour de taille.' },
        de: { name: 'Gürtel', category: 'Accessoires', short: 'Ein Gürtel aus pflanzlich gegerbtem Leder. Handgefinishte Kanten.', long: 'Dieser Gürtel besteht aus dickem, natürlichem pflanzlich gegerbtem Leder. Die Kanten sind von Hand gefinisht, die Schnalle ist aus Metall. Mit der Zeit dunkelt das Leder nach und bekommt eine eigene Patina. Auf Bestellung gefertigt, nach Ihrem Taillenmaß.' },
        es: { name: 'Cinturón', category: 'Accesorios', short: 'Un cinturón en cuero de curtido vegetal. Bordes acabados a mano.', long: 'Este cinturón está hecho de cuero natural de curtido vegetal grueso. Los bordes están acabados a mano y la hebilla es de metal. Con el tiempo, el cuero se oscurece y gana una pátina propia. Hecho por encargo, a la medida de su cintura.' },
        it: { name: 'Cintura', category: 'Accessori', short: 'Una cintura in cuoio a concia vegetale. Bordi rifiniti a mano.', long: 'Questa cintura è realizzata in cuoio naturale a concia vegetale spesso. I bordi sono rifiniti a mano e la fibbia è in metallo. Con il tempo il cuoio si scurisce e acquisisce una patina propria. Realizzata su ordinazione, secondo la sua misura di vita.' }
      }
    },

    {
      slug: 'slim-wallet',
      price: 99,
      discount: 25,
      video: 'card_wallet.mp4',
      size: {
        lt: 'Dydis: 10 cm x 7.5 cm', en: 'Size: 10 cm x 7.5 cm', pt: 'Tamanho: 10 cm x 7,5 cm',
        fr: 'Taille : 10 cm x 7,5 cm', de: 'Größe: 10 cm x 7,5 cm', es: 'Tamaño: 10 cm x 7,5 cm', it: 'Dimensioni: 10 cm x 7,5 cm'
      },
      t: {
        lt: { name: 'Slim wallet', category: 'Piniginės', short: 'Piniginė iš augalinio rauginimo odos. Trys skyriai kortelėms.', long: 'Ši piniginė pagaminta iš natūralios, augaliniu būdu raugintos odos. Trys skyriai kortelėms: iš pradžių telpa 6, o laikui bėgant oda natūraliai prisitaiko – tilps ir daugiau. Viduryje – vietos sulankstytiems banknotams ar kvitams.' },
        en: { name: 'Slim wallet', category: 'Wallets', short: 'A wallet in vegetable-tanned leather. Three card slots.', long: 'This wallet is made of natural, vegetable-tanned leather. Three card slots: fits 6 at first, and as the leather adapts over time it will hold more. In the middle — room for folded banknotes or receipts.' },
        pt: { name: 'Slim wallet', category: 'Carteiras', short: 'Carteira em couro de curtimento vegetal. Três compartimentos para cartões.', long: 'Esta carteira é feita em couro natural de curtimento vegetal. Três compartimentos para cartões: cabem 6 no início e, à medida que o couro se adapta com o tempo, caberão mais. No meio — espaço para notas dobradas ou recibos.' },
        fr: { name: 'Slim wallet', category: 'Portefeuilles', short: 'Un portefeuille en cuir à tannage végétal. Trois emplacements pour cartes.', long: 'Ce portefeuille est fabriqué en cuir naturel à tannage végétal. Trois emplacements pour cartes : 6 au début, et à mesure que le cuir s’assouplit, il en contiendra davantage. Au centre — de la place pour des billets pliés ou des reçus.' },
        de: { name: 'Slim wallet', category: 'Portemonnaies', short: 'Eine Geldbörse aus pflanzlich gegerbtem Leder. Drei Kartenfächer.', long: 'Diese Geldbörse besteht aus natürlichem, pflanzlich gegerbtem Leder. Drei Kartenfächer: anfangs für 6 Karten, und mit der Zeit passt sich das Leder an und fasst mehr. In der Mitte — Platz für gefaltete Scheine oder Belege.' },
        es: { name: 'Slim wallet', category: 'Carteras', short: 'Una cartera en cuero de curtido vegetal. Tres compartimentos para tarjetas.', long: 'Esta cartera está hecha de cuero natural de curtido vegetal. Tres compartimentos para tarjetas: al principio caben 6 y, a medida que el cuero se adapta con el tiempo, cabrán más. En el centro, espacio para billetes doblados o recibos.' },
        it: { name: 'Slim wallet', category: 'Portafogli', short: 'Un portafoglio in cuoio a concia vegetale. Tre scomparti per carte.', long: 'Questo portafoglio è realizzato in cuoio naturale a concia vegetale. Tre scomparti per carte: all’inizio ne contiene 6 e, man mano che il cuoio si adatta nel tempo, ne conterrà di più. Al centro — spazio per banconote piegate o scontrini.' }
      }
    },

    {
      slug: 'rankine-giedra',
      price: null,
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Rankinė Giedra', category: 'Rankinės', short: 'Vienas pagrindinis skyrius. Reguliuojamas dirželis.', long: 'Pagaminta iš augalinio rauginimo odos, be pamušalo. Vienas pagrindinis skyrius. Dirželis reguliuojamas. Rankomis siūta.' },
        en: { name: 'Bag Giedra', category: 'Bags', short: 'One main compartment. Adjustable strap.', long: 'Made of vegetable-tanned leather, unlined. One main compartment. Adjustable strap. Hand-stitched.' },
        pt: { name: 'Bolsa Giedra', category: 'Bolsas', short: 'Um compartimento principal. Alça ajustável.', long: 'Feita em couro de curtimento vegetal, sem forro. Um compartimento principal. Alça ajustável. Costurada à mão.' },
        fr: { name: 'Sac Giedra', category: 'Sacs', short: 'Un compartiment principal. Bandoulière réglable.', long: 'Fabriqué en cuir à tannage végétal, sans doublure. Un compartiment principal. Bandoulière réglable. Cousu main.' },
        de: { name: 'Tasche Giedra', category: 'Taschen', short: 'Ein Hauptfach. Verstellbarer Riemen.', long: 'Aus pflanzlich gegerbtem Leder, ungefüttert. Ein Hauptfach. Verstellbarer Riemen. Handgenäht.' },
        es: { name: 'Bolso Giedra', category: 'Bolsos', short: 'Un compartimento principal. Correa ajustable.', long: 'Hecho de cuero de curtido vegetal, sin forro. Un compartimento principal. Correa ajustable. Cosido a mano.' },
        it: { name: 'Borsa Giedra', category: 'Borse', short: 'Uno scomparto principale. Tracolla regolabile.', long: 'Realizzata in cuoio a concia vegetale, senza fodera. Uno scomparto principale. Tracolla regolabile. Cucita a mano.' }
      }
    },

    {
      slug: 'kompiuterio-deklas',
      price: null,
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Kompiuterio Dėklas', category: 'Aksesuarai', short: 'Tvirtas ir minimalistinis, su paslėptais magnetais.', long: 'Pagamintas iš natūralios augalinio rauginimo odos. Tvirtas ir minimalistinis – be pamušalo, su vidine oda. Uždarymas su paslėptais magnetais. Tinkamas kasdieniam naudojimui – apsaugo nuo įbrėžimų ir smulkių pažeidimų.' },
        en: { name: 'Laptop Sleeve', category: 'Accessories', short: 'Sturdy and minimalist, with hidden magnets.', long: 'Made of natural vegetable-tanned leather. Sturdy and minimalist — unlined, with an inner leather layer. Hidden-magnet closure. Made for everyday use — protects from scratches and minor damage.' },
        pt: { name: 'Capa para Portátil', category: 'Acessórios', short: 'Resistente e minimalista, com ímanes escondidos.', long: 'Feita em couro natural de curtimento vegetal. Resistente e minimalista — sem forro, com uma camada interior de couro. Fecho com ímanes escondidos. Feita para uso diário — protege de riscos e pequenos danos.' },
        fr: { name: 'Housse pour Ordinateur', category: 'Accessoires', short: 'Robuste et minimaliste, avec aimants cachés.', long: 'Fabriquée en cuir naturel à tannage végétal. Robuste et minimaliste — sans doublure, avec une couche de cuir intérieure. Fermeture à aimants cachés. Conçue pour un usage quotidien — protège des rayures et petits dommages.' },
        de: { name: 'Laptop-Hülle', category: 'Accessoires', short: 'Robust und minimalistisch, mit verborgenen Magneten.', long: 'Aus natürlichem, pflanzlich gegerbtem Leder. Robust und minimalistisch — ungefüttert, mit einer inneren Lederschicht. Verschluss mit verborgenen Magneten. Für den täglichen Gebrauch — schützt vor Kratzern und kleinen Schäden.' },
        es: { name: 'Funda para Portátil', category: 'Accesorios', short: 'Resistente y minimalista, con imanes ocultos.', long: 'Hecha de cuero natural de curtido vegetal. Resistente y minimalista: sin forro, con una capa interior de cuero. Cierre con imanes ocultos. Pensada para el uso diario: protege de arañazos y pequeños daños.' },
        it: { name: 'Custodia per Laptop', category: 'Accessori', short: 'Robusta e minimalista, con magneti nascosti.', long: 'Realizzata in cuoio naturale a concia vegetale. Robusta e minimalista — senza fodera, con uno strato interno in cuoio. Chiusura con magneti nascosti. Pensata per l’uso quotidiano — protegge da graffi e piccoli danni.' }
      }
    },

    {
      slug: 'knygu-skirtukas',
      price: null,
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Knygų skirtukas', category: 'Aksesuarai', short: 'Plonas, lankstus rankų darbo skirtukas.', long: 'Plonas, rankų darbo skirtukas iš natūralios augalinio rauginimo odos. Lankstus, bet tvirtas – patogiai įsistato tarp puslapių. Laikui bėgant oda švelniai patamsėja ir įgauna unikalų atspalvį.' },
        en: { name: 'Bookmark', category: 'Accessories', short: 'A thin, flexible handmade bookmark.', long: 'A thin, handmade bookmark of natural vegetable-tanned leather. Flexible yet sturdy — sits comfortably between pages. Over time the leather gently darkens and gains a unique tone.' },
        pt: { name: 'Marcador de Livros', category: 'Acessórios', short: 'Um marcador de livros fino e flexível, feito à mão.', long: 'Um marcador de livros fino, feito à mão em couro natural de curtimento vegetal. Flexível mas resistente — assenta confortavelmente entre as páginas. Com o tempo, o couro escurece suavemente e ganha um tom único.' },
        fr: { name: 'Marque-page', category: 'Accessoires', short: 'Un marque-page fin et souple, fait main.', long: 'Un marque-page fin, fait main en cuir naturel à tannage végétal. Souple mais résistant — il se glisse confortablement entre les pages. Avec le temps, le cuir fonce doucement et prend une teinte unique.' },
        de: { name: 'Lesezeichen', category: 'Accessoires', short: 'Ein dünnes, flexibles handgemachtes Lesezeichen.', long: 'Ein dünnes, handgefertigtes Lesezeichen aus natürlichem, pflanzlich gegerbtem Leder. Flexibel und doch stabil — liegt bequem zwischen den Seiten. Mit der Zeit dunkelt das Leder sanft nach und bekommt einen einzigartigen Ton.' },
        es: { name: 'Marcapáginas', category: 'Accesorios', short: 'Un marcapáginas fino y flexible, hecho a mano.', long: 'Un marcapáginas fino, hecho a mano en cuero natural de curtido vegetal. Flexible pero resistente: se coloca cómodamente entre las páginas. Con el tiempo, el cuero se oscurece suavemente y adquiere un tono único.' },
        it: { name: 'Segnalibro', category: 'Accessori', short: 'Un segnalibro sottile e flessibile, fatto a mano.', long: 'Un segnalibro sottile, fatto a mano in cuoio naturale a concia vegetale. Flessibile ma robusto — si posiziona comodamente tra le pagine. Con il tempo il cuoio si scurisce delicatamente e acquista una tonalità unica.' }
      }
    },

    {
      slug: 'pinigine-rukas',
      price: null,
      size: {
        lt: 'Atvira – 21 x 8.5 x 1 cm · Užverta – 10.5 x 8.5 x 2 cm', en: 'Open – 21 x 8.5 x 1 cm · Closed – 10.5 x 8.5 x 2 cm',
        pt: 'Aberta – 21 x 8,5 x 1 cm · Fechada – 10,5 x 8,5 x 2 cm', fr: 'Ouvert – 21 x 8,5 x 1 cm · Fermé – 10,5 x 8,5 x 2 cm',
        de: 'Offen – 21 x 8,5 x 1 cm · Geschlossen – 10,5 x 8,5 x 2 cm', es: 'Abierta – 21 x 8,5 x 1 cm · Cerrada – 10,5 x 8,5 x 2 cm',
        it: 'Aperto – 21 x 8,5 x 1 cm · Chiuso – 10,5 x 8,5 x 2 cm'
      },
      t: {
        lt: { name: 'Piniginė Rūkas', category: 'Piniginės', short: 'Kompaktiška piniginė, uždaroma spaude.', long: 'Kompaktiška rankų darbo piniginė kasdieniam naudojimui. Pagaminta iš natūralios augalinio rauginimo odos. Trys skyreliai kortelėms, atskiras skyrelis monetoms ir vieta popierinėms kupiūroms. Uždarymas – spaude. Tvirta, ilgaamžė, su laiku įgaunanti natūralų patinos atspalvį.' },
        en: { name: 'Wallet Rūkas', category: 'Wallets', short: 'A compact wallet with a snap closure.', long: 'A compact handmade wallet for everyday use. Made of natural vegetable-tanned leather. Three card slots, a separate coin pocket and room for banknotes. Snap closure. Sturdy, long-lasting, developing a natural patina over time.' },
        pt: { name: 'Carteira Rūkas', category: 'Carteiras', short: 'Uma carteira compacta com fecho de mola.', long: 'Uma carteira compacta feita à mão para uso diário. Feita em couro natural de curtimento vegetal. Três compartimentos para cartões, um bolso separado para moedas e espaço para notas. Fecho de mola. Resistente, duradoura, desenvolvendo uma pátina natural com o tempo.' },
        fr: { name: 'Portefeuille Rūkas', category: 'Portefeuilles', short: 'Un portefeuille compact à fermeture pression.', long: 'Un portefeuille compact fait main pour un usage quotidien. En cuir naturel à tannage végétal. Trois emplacements pour cartes, une poche à monnaie séparée et de la place pour les billets. Fermeture pression. Robuste, durable, développant une patine naturelle avec le temps.' },
        de: { name: 'Portemonnaie Rūkas', category: 'Portemonnaies', short: 'Ein kompaktes Portemonnaie mit Druckknopfverschluss.', long: 'Ein kompaktes, handgefertigtes Portemonnaie für den Alltag. Aus natürlichem, pflanzlich gegerbtem Leder. Drei Kartenfächer, ein separates Münzfach und Platz für Scheine. Druckknopfverschluss. Robust, langlebig, entwickelt mit der Zeit eine natürliche Patina.' },
        es: { name: 'Cartera Rūkas', category: 'Carteras', short: 'Una cartera compacta con cierre de botón a presión.', long: 'Una cartera compacta hecha a mano para el uso diario. Hecha de cuero natural de curtido vegetal. Tres compartimentos para tarjetas, un bolsillo separado para monedas y espacio para billetes. Cierre de botón a presión. Resistente, duradera, desarrolla una pátina natural con el tiempo.' },
        it: { name: 'Portafoglio Rūkas', category: 'Portafogli', short: 'Un portafoglio compatto con chiusura a bottone.', long: 'Un portafoglio compatto fatto a mano per l’uso quotidiano. Realizzato in cuoio naturale a concia vegetale. Tre scomparti per carte, una tasca separata per monete e spazio per banconote. Chiusura a bottone automatico. Robusto, duraturo, sviluppa una patina naturale nel tempo.' }
      }
    },

    {
      slug: 'raktu-pakabukas',
      price: null,
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Raktų pakabukas', category: 'Raktų aksesuarai', short: 'Minimalistinis dizainas, metalinis žiedas raktams.', long: 'Pagamintas iš natūralios augalinio rauginimo odos. Minimalistinis dizainas. Metalinis žiedas raktams pritvirtintas kniede. Ilgaamžis ir patogus naudoti kasdien.' },
        en: { name: 'Key Fob', category: 'Key accessories', short: 'Minimalist design, metal key ring.', long: 'Made of natural vegetable-tanned leather. Minimalist design. Metal key ring fixed with a rivet. Durable and convenient for everyday use.' },
        pt: { name: 'Porta-chaves', category: 'Acessórios de chaves', short: 'Design minimalista, argola metálica para chaves.', long: 'Feito em couro natural de curtimento vegetal. Design minimalista. Argola metálica para chaves fixada com um rebite. Duradouro e prático para uso diário.' },
        fr: { name: 'Porte-clés', category: 'Accessoires de clés', short: 'Design minimaliste, anneau métallique pour clés.', long: 'Fabriqué en cuir naturel à tannage végétal. Design minimaliste. Anneau métallique fixé par un rivet. Durable et pratique au quotidien.' },
        de: { name: 'Schlüsselanhänger', category: 'Schlüsselaccessoires', short: 'Minimalistisches Design, Metall-Schlüsselring.', long: 'Aus natürlichem, pflanzlich gegerbtem Leder. Minimalistisches Design. Metall-Schlüsselring mit einer Niete befestigt. Langlebig und praktisch für den täglichen Gebrauch.' },
        es: { name: 'Llavero', category: 'Accesorios de llaves', short: 'Diseño minimalista, anilla metálica para llaves.', long: 'Hecho de cuero natural de curtido vegetal. Diseño minimalista. Anilla metálica para llaves fijada con un remache. Duradero y práctico para el uso diario.' },
        it: { name: 'Portachiavi', category: 'Accessori per chiavi', short: 'Design minimalista, anello metallico per chiavi.', long: 'Realizzato in cuoio naturale a concia vegetale. Design minimalista. Anello metallico per chiavi fissato con un rivetto. Resistente e pratico per l’uso quotidiano.' }
      }
    },

    {
      slug: 'mini-pinigine-vingis',
      price: 120,
      discount: 25,
      video: 'mini_pinigine.mp4',
      size: {
        lt: 'Dydis: apie 11 cm x 7 cm', en: 'Size: approx. 11 cm x 7 cm', pt: 'Tamanho: aprox. 11 cm x 7 cm',
        fr: 'Taille : env. 11 cm x 7 cm', de: 'Größe: ca. 11 cm x 7 cm', es: 'Tamaño: aprox. 11 cm x 7 cm', it: 'Dimensioni: circa 11 cm x 7 cm'
      },
      t: {
        lt: { name: 'Mini Wallet', category: 'Piniginės', short: 'Kompaktiška piniginė kortelėms ir monetoms.', long: 'Kompaktiška piniginė, sukurta iš natūralios augalinio rauginimo odos – patogi laikyti korteles ar monetas. Viduje ir išorėje – papildomas skyrelis kortelėms. Oda – organiška medžiaga, todėl kiekvienas gaminys unikalus, su savitu raštu ar žyme.' },
        en: { name: 'Mini Wallet', category: 'Wallets', short: 'A compact wallet for cards and coins.', long: 'A compact wallet made of natural vegetable-tanned leather — handy for cards or coins. An extra card slot inside and out. Leather is an organic material, so each piece is unique, with its own grain or mark.' },
        pt: { name: 'Mini Wallet', category: 'Carteiras', short: 'Uma carteira compacta para cartões e moedas.', long: 'Uma carteira compacta feita em couro natural de curtimento vegetal — prática para cartões ou moedas. Um compartimento extra para cartões por dentro e por fora. O couro é um material orgânico, por isso cada peça é única, com o seu próprio grão ou marca.' },
        fr: { name: 'Mini Wallet', category: 'Portefeuilles', short: 'Un portefeuille compact pour cartes et pièces.', long: 'Un portefeuille compact en cuir naturel à tannage végétal — pratique pour les cartes ou la monnaie. Un emplacement carte supplémentaire à l’intérieur et à l’extérieur. Le cuir est une matière organique, chaque pièce est donc unique, avec son grain ou sa marque.' },
        de: { name: 'Mini Wallet', category: 'Portemonnaies', short: 'Ein kompaktes Portemonnaie für Karten und Münzen.', long: 'Ein kompaktes Portemonnaie aus natürlichem, pflanzlich gegerbtem Leder — praktisch für Karten oder Münzen. Ein zusätzliches Kartenfach innen und außen. Leder ist ein organisches Material, daher ist jedes Stück einzigartig, mit eigener Narbung oder Zeichnung.' },
        es: { name: 'Mini Wallet', category: 'Carteras', short: 'Una cartera compacta para tarjetas y monedas.', long: 'Una cartera compacta hecha de cuero natural de curtido vegetal: práctica para tarjetas o monedas. Un compartimento extra para tarjetas por dentro y por fuera. El cuero es un material orgánico, por lo que cada pieza es única, con su propio grano o marca.' },
        it: { name: 'Mini Wallet', category: 'Portafogli', short: 'Un portafoglio compatto per carte e monete.', long: 'Un portafoglio compatto in cuoio naturale a concia vegetale — pratico per carte o monete. Uno scomparto extra per carte all’interno e all’esterno. Il cuoio è un materiale organico, quindi ogni pezzo è unico, con la propria grana o segno.' }
      }
    },

    {
      slug: 'rankine-tyla',
      price: 1800,
      discount: 30,
      video: 'didele_rankine.mp4',
      size: {
        lt: 'Aukštis 15 cm · Plotis 19 cm · Gylis 5 cm', en: 'Height 15 cm · Width 19 cm · Depth 5 cm',
        pt: 'Altura 15 cm · Largura 19 cm · Profundidade 5 cm', fr: 'Hauteur 15 cm · Largeur 19 cm · Profondeur 5 cm',
        de: 'Höhe 15 cm · Breite 19 cm · Tiefe 5 cm', es: 'Alto 15 cm · Ancho 19 cm · Fondo 5 cm', it: 'Altezza 15 cm · Larghezza 19 cm · Profondità 5 cm'
      },
      t: {
        lt: { name: 'Maxi Bag', category: 'Rankinės', short: 'Užsegama spaude. Vidinė ir išorinė kišenė.', long: 'Rankų darbo rankinė, pagaminta iš augalinio rauginimo odos, be pamušalo. Užsegama spaude. Vienas pagrindinis skyrius – užsegama kišenė viduje ir atvira išorėje. Dirželis reguliuojamas (2 cm pločio, 115–135 cm arba fiksuotas 125 cm).' },
        en: { name: 'Maxi Bag', category: 'Bags', short: 'Snap closure. Inner and outer pockets.', long: 'A handmade bag of vegetable-tanned leather, unlined. Snap closure. One main compartment — a zipped pocket inside and an open one outside. Adjustable strap (2 cm wide, 115–135 cm or fixed 125 cm).' },
        pt: { name: 'Maxi Bag', category: 'Bolsas', short: 'Fecho de mola. Bolsos interior e exterior.', long: 'Uma bolsa feita à mão em couro de curtimento vegetal, sem forro. Fecho de mola. Um compartimento principal — um bolso com fecho no interior e um aberto no exterior. Alça ajustável (2 cm de largura, 115–135 cm ou fixa 125 cm).' },
        fr: { name: 'Maxi Bag', category: 'Sacs', short: 'Fermeture pression. Poches intérieure et extérieure.', long: 'Un sac fait main en cuir à tannage végétal, sans doublure. Fermeture pression. Un compartiment principal — une poche zippée à l’intérieur et une ouverte à l’extérieur. Bandoulière réglable (2 cm de large, 115–135 cm ou fixe 125 cm).' },
        de: { name: 'Maxi Bag', category: 'Taschen', short: 'Druckknopfverschluss. Innen- und Außentasche.', long: 'Eine handgefertigte Tasche aus pflanzlich gegerbtem Leder, ungefüttert. Druckknopfverschluss. Ein Hauptfach — eine Reißverschlusstasche innen und eine offene außen. Verstellbarer Riemen (2 cm breit, 115–135 cm oder fix 125 cm).' },
        es: { name: 'Maxi Bag', category: 'Bolsos', short: 'Cierre de botón a presión. Bolsillos interior y exterior.', long: 'Un bolso hecho a mano en cuero de curtido vegetal, sin forro. Cierre de botón a presión. Un compartimento principal: un bolsillo con cremallera dentro y uno abierto fuera. Correa ajustable (2 cm de ancho, 115–135 cm o fija 125 cm).' },
        it: { name: 'Maxi Bag', category: 'Borse', short: 'Chiusura a bottone. Tasche interna ed esterna.', long: 'Una borsa fatta a mano in cuoio a concia vegetale, senza fodera. Chiusura a bottone automatico. Uno scomparto principale — una tasca con zip all’interno e una aperta all’esterno. Tracolla regolabile (2 cm di larghezza, 115–135 cm o fissa 125 cm).' }
      }
    },

    {
      slug: 'rankine-migla',
      price: 1500,
      discount: 30,
      video: 'juoda_rankine.mp4',
      size: { lt: '', en: '', pt: '', fr: '', de: '', es: '', it: '' },
      t: {
        lt: { name: 'Medi Bag', category: 'Rankinės', short: 'Augalinio rauginimo oda, be pamušalo. Rankomis siūta.', long: 'Pagaminta iš augalinio rauginimo odos, be pamušalo. Dirželis reguliuojamas. Rankomis siūta.' },
        en: { name: 'Medi Bag', category: 'Bags', short: 'Vegetable-tanned leather, unlined. Hand-stitched.', long: 'Made of vegetable-tanned leather, unlined. Adjustable strap. Hand-stitched.' },
        pt: { name: 'Medi Bag', category: 'Bolsas', short: 'Couro de curtimento vegetal, sem forro. Costurada à mão.', long: 'Feita em couro de curtimento vegetal, sem forro. Alça ajustável. Costurada à mão.' },
        fr: { name: 'Medi Bag', category: 'Sacs', short: 'Cuir à tannage végétal, sans doublure. Cousu main.', long: 'Fabriqué en cuir à tannage végétal, sans doublure. Bandoulière réglable. Cousu main.' },
        de: { name: 'Medi Bag', category: 'Taschen', short: 'Pflanzlich gegerbtes Leder, ungefüttert. Handgenäht.', long: 'Aus pflanzlich gegerbtem Leder, ungefüttert. Verstellbarer Riemen. Handgenäht.' },
        es: { name: 'Medi Bag', category: 'Bolsos', short: 'Cuero de curtido vegetal, sin forro. Cosido a mano.', long: 'Hecho de cuero de curtido vegetal, sin forro. Correa ajustable. Cosido a mano.' },
        it: { name: 'Medi Bag', category: 'Borse', short: 'Cuoio a concia vegetale, senza fodera. Cucita a mano.', long: 'Realizzata in cuoio a concia vegetale, senza fodera. Tracolla regolabile. Cucita a mano.' }
      }
    }

  ]

};
