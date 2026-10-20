// Original practice material written for this platform.
// It follows the topics and grammar of each Yedi İklim A1 unit but is NOT textbook text.
// Every item is deterministic (has a verifiable answer), so grading needs no AI call.

export type Question =
  | { id: string; type: "mcq"; prompt: string; options: string[]; answer: number; explain: string; pages?: number[] }
  | { id: string; type: "tf"; prompt: string; answer: boolean; explain: string; pages?: number[] };

export type DialogueLine = { speaker: string; text: string; voice: "a" | "b" };

export type UnitPractice = {
  unit: number;
  reading: { title: string; text: string; questions: Question[] };
  listening: { title: string; lines: DialogueLine[]; questions: Question[]; dictation: string[] };
  grammar: Question[];
  writing: { id: string; tr: string; kz: string; minSentences: number; focus: string; pages: number[] }[];
  speaking: { topic: string; kz: string; questions: string[]; pages: number[] };
};

const mcq = (id: string, prompt: string, options: string[], answer: number, explain: string, pages?: number[]): Question => ({
  id, type: "mcq", prompt, options, answer, explain, pages,
});
const tf = (id: string, prompt: string, answer: boolean, explain: string, pages?: number[]): Question => ({
  id, type: "tf", prompt, answer, explain, pages,
});
const A = (speaker: string, text: string): DialogueLine => ({ speaker, text, voice: "a" });
const B = (speaker: string, text: string): DialogueLine => ({ speaker, text, voice: "b" });

export const PRACTICE: UnitPractice[] = [
  {
    unit: 1,
    reading: {
      title: "Yeni Sınıfım",
      text:
        "Merhaba! Benim adım Aigerim. Ben Kazakistanlıyım, Almatılıyım. Ben öğrenciyim. " +
        "Sınıfımız büyük. Sınıfta yirmi öğrenci var. Öğretmenimizin adı Selin. O Türkiyeli. " +
        "Sınıfta bir harita, bir televizyon ve bir bilgisayar var. Ama sınıfta kanepe yok. " +
        "Benim arkadaşım Yuki. O Japonyalı. Yuki çok iyi bir öğrenci.",
      questions: [
        mcq("u1r1", "Aigerim nereli?", ["Japonyalı", "Kazakistanlı", "Türkiyeli", "Rusyalı"], 1, "Мәтінде: «Ben Kazakistanlıyım». -lI жұрнағы шығу тегін білдіреді.", [17, 18]),
        tf("u1r2", "Sınıfta yirmi öğrenci var.", true, "«Sınıfta yirmi öğrenci var» — дұрыс.", [20]),
        tf("u1r3", "Sınıfta kanepe var.", false, "«Sınıfta kanepe yok» — диван жоқ.", [20, 21]),
        mcq("u1r4", "Öğretmenin adı ne?", ["Yuki", "Aigerim", "Selin", "Ayşe"], 2, "«Öğretmenimizin adı Selin».", [10]),
        mcq("u1r5", "Yuki nereli?", ["Japonyalı", "Türkiyeli", "Almatılı", "İranlı"], 0, "«O Japonyalı» — Yuki жапониялық.", [18]),
      ],
    },
    listening: {
      title: "Tanışalım",
      lines: [
        A("Murat", "Merhaba, benim adım Murat. Sizin adınız ne?"),
        B("Elif", "Merhaba, benim adım Elif. Memnun oldum."),
        A("Murat", "Ben de memnun oldum. Nerelisiniz?"),
        B("Elif", "Ben İzmirliyim. Siz nerelisiniz?"),
        A("Murat", "Ben Ankaralıyım. Öğrenci misiniz?"),
        B("Elif", "Hayır, öğrenci değilim. Ben öğretmenim. Siz?"),
        A("Murat", "Ben öğrenciyim. Görüşmek üzere!"),
        B("Elif", "Hoşça kalın!"),
      ],
      questions: [
        mcq("u1l1", "Elif nereli?", ["Ankaralı", "İzmirli", "İstanbullu", "Bursalı"], 1, "Элиф: «Ben İzmirliyim».", [18]),
        tf("u1l2", "Elif öğrenci.", false, "«Hayır, öğrenci değilim. Ben öğretmenim» — değil = емес.", [21]),
        mcq("u1l3", "Murat nereli?", ["İzmirli", "Ankaralı", "Antalyalı", "Konyalı"], 1, "Мұрат: «Ben Ankaralıyım».", [18]),
        mcq("u1l4", "Murat ne iş yapıyor?", ["Öğretmen", "Doktor", "Öğrenci", "Şoför"], 2, "Мұрат: «Ben öğrenciyim».", [17]),
      ],
      dictation: ["Benim adım Murat.", "Memnun oldum.", "Ben Ankaralıyım.", "Hoşça kalın!"],
    },
    grammar: [
      mcq("u1g1", "Bu kalem ___?", ["mı", "mi", "mu", "mü"], 1, "Соңғы дауысты «e» (kalem) → mi. Сұраулық шылау бөлек жазылады.", [21, 22]),
      mcq("u1g2", "Ben öğretmen ___. (емеспін)", ["değilim", "değil", "yok", "mıyım"], 0, "değil + жіктік жалғау: değilim «емеспін».", [21]),
      mcq("u1g3", "Kitap masa___.", ["da", "de", "ta", "te"], 0, "masa → жуан дауысты (a), ұяң соңы → -da.", [42]),
      mcq("u1g4", "Silgi sepet___.", ["da", "de", "ta", "te"], 3, "sepet қатаң «t»-мен бітеді, жіңішке → -te.", [42]),
      mcq("u1g5", "Sınıfta harita var mı? — Hayır, ___.", ["var", "yok", "değil", "mı"], 1, "Заттың болмауы → yok.", [21]),
      mcq("u1g6", "«Екі кітап» түрікше қалай?", ["iki kitaplar", "iki kitap", "ikiler kitap", "iki kitabı"], 1, "Саннан кейін көптік жалғау жалғанбайды.", [29]),
      mcq("u1g7", "ev → көпше", ["evlar", "evler", "evlır", "evlerler"], 1, "Жіңішке «e» → -ler.", [29]),
      mcq("u1g8", "Burası ___? — Burası okul.", ["kim", "ne", "neresi", "nasıl"], 2, "Орын туралы сұрақ: Burası neresi?", [15]),
    ],
    writing: [
      { id: "u1w1", tr: "Kendinizi tanıtın: adınız, nerelisiniz, ne iş yapıyorsunuz?", kz: "Өзіңізді таныстырыңыз: атыңыз, қай жерліксіз, не істейсіз?", minSentences: 5, focus: "Жіктік жалғаулар, -lI", pages: [10, 17, 18] },
      { id: "u1w2", tr: "Sınıfınızda ne var, ne yok? Yazın.", kz: "Сыныбыңызда не бар, не жоқ? Жазыңыз.", minSentences: 5, focus: "var / yok, -DA", pages: [20, 21] },
    ],
    speaking: { topic: "Tanışma", kz: "Танысу", pages: [10, 11, 17, 26], questions: ["Adınız ne?", "Nerelisiniz?", "Nasılsınız?", "Öğrenci misiniz?", "Sınıfınızda kaç öğrenci var?"] },
  },
  {
    unit: 2,
    reading: {
      title: "Benim Ailem",
      text:
        "Benim adım Arman. On dokuz yaşındayım. Ailem büyük. Babamın adı Serik. O mühendis. " +
        "Annemin adı Gülnar. O öğretmen. Bir ablam ve bir erkek kardeşim var. Ablam yirmi üç yaşında, doktor. " +
        "Kardeşim on iki yaşında, ortaokulda okuyor. Evimiz Astana'da. Evimizde üç yatak odası, bir salon ve bir mutfak var. " +
        "Akşam hep birlikte yemek yiyoruz. Ben ailemi çok seviyorum.",
      questions: [
        mcq("u2r1", "Arman kaç yaşında?", ["On iki", "On dokuz", "Yirmi üç", "Otuz"], 1, "«On dokuz yaşındayım».", [34]),
        tf("u2r2", "Arman'ın annesi doktor.", false, "Анасы — öğretmen; doktor — әпкесі.", [35]),
        mcq("u2r3", "Evde kaç yatak odası var?", ["Bir", "İki", "Üç", "Dört"], 2, "«üç yatak odası».", [39]),
        tf("u2r4", "Aile akşam birlikte yemek yiyor.", true, "«Akşam hep birlikte yemek yiyoruz».", [48]),
        mcq("u2r5", "Kardeşi nerede okuyor?", ["Lisede", "Ortaokulda", "Üniversitede", "İlkokulda"], 1, "«ortaokulda okuyor».", [98]),
      ],
    },
    listening: {
      title: "Nerede Oturuyorsun?",
      lines: [
        A("Deniz", "Selim, nerede oturuyorsun?"),
        B("Selim", "Çamlıca Mahallesi'nde oturuyorum. Ya sen?"),
        A("Deniz", "Ben Kızılay'da oturuyorum. Evin büyük mü?"),
        B("Selim", "Evet, büyük. Evimizde dört oda var. Bahçemiz de var."),
        A("Deniz", "Kardeşin var mı?"),
        B("Selim", "Evet, iki kardeşim var. Biri kız, biri erkek."),
        A("Deniz", "Şimdi nereye gidiyorsun?"),
        B("Selim", "Okula gidiyorum. Görüşürüz!"),
      ],
      questions: [
        mcq("u2l1", "Selim nerede oturuyor?", ["Kızılay'da", "Çamlıca Mahallesi'nde", "İzmir'de", "Okulda"], 1, "«Çamlıca Mahallesi'nde oturuyorum».", [49]),
        mcq("u2l2", "Selim'in evinde kaç oda var?", ["İki", "Üç", "Dört", "Beş"], 2, "«Evimizde dört oda var».", [39]),
        tf("u2l3", "Selim'in bahçesi yok.", false, "«Bahçemiz de var» — бақшасы бар.", [39]),
        mcq("u2l4", "Selim nereye gidiyor?", ["Eve", "Pazara", "Okula", "Parka"], 2, "«Okula gidiyorum» — барыс септігі -a.", [51]),
      ],
      dictation: ["Nerede oturuyorsun?", "Evimizde dört oda var.", "Okula gidiyorum.", "İki kardeşim var."],
    },
    grammar: [
      mcq("u2g1", "Ali okul___ geliyor.", ["dan", "da", "a", "u"], 0, "Қайдан? → шығыс септігі -dan.", [51]),
      mcq("u2g2", "Ben ev___ gidiyorum.", ["den", "de", "e", "i"], 2, "Қайда (бағыт)? → барыс -e.", [51]),
      mcq("u2g3", "Ayşe kitab___ okuyor. (нақты кітапты)", ["ı", "a", "da", "dan"], 0, "Табыс септігі: kitap → kitabı (p → b).", [50]),
      mcq("u2g4", "Biz Türkçe öğren___.", ["iyoruz", "iyorum", "iyorsun", "iyorlar"], 0, "biz → -Iyoruz.", [44]),
      mcq("u2g5", "Onlar televizyon ___.", ["izliyorlar", "izleyorlar", "izliyoruz", "izleyiyorlar"], 0, "izle- + -yor → izliyor (e → i).", [44, 48]),
      mcq("u2g6", "Kahvaltı___ sonra okula gidiyorum.", ["dan", "da", "ya", "yı"], 0, "-DAn sonra «...дан кейін».", [48, 59]),
      mcq("u2g7", "benim + anne →", ["annem", "annen", "annesi", "anneniz"], 0, "1-жақ тәуелдік: -(I)m.", [34, 37]),
      mcq("u2g8", "Kapıyı ___! (сенге бұйрық, aç-)", ["aç", "açıyor", "açtı", "açacak"], 0, "Сенге бұйрық — етістіктің түбірі.", [38]),
    ],
    writing: [
      { id: "u2w1", tr: "Ailenizi tanıtın.", kz: "Отбасыңызды таныстырыңыз.", minSentences: 6, focus: "Тәуелдік, ilik: annemin adı", pages: [34, 35, 37] },
      { id: "u2w2", tr: "Bir gününüzü anlatın: sabah ne yapıyorsunuz?", kz: "Бір күніңізді айтып беріңіз (нақ осы шақ).", minSentences: 6, focus: "-Iyor, -DAn sonra", pages: [47, 48] },
    ],
    speaking: { topic: "Ailem ve evim", kz: "Отбасы және үй", pages: [34, 37, 39, 49], questions: ["Kaç kardeşiniz var?", "Babanız ne iş yapıyor?", "Nerede oturuyorsunuz?", "Evinizde kaç oda var?", "Sabah ne yapıyorsunuz?"] },
  },
  {
    unit: 3,
    reading: {
      title: "Dünkü Günüm",
      text:
        "Dün cumartesiydi. Sabah saat sekizde uyandım. Kahvaltıda peynir, zeytin ve yumurta yedim, çay içtim. " +
        "Saat onu çeyrek geçe pazara gittim. Pazardan iki kilo domates ve bir kilo elma aldım. Domatesin kilosu on lira. " +
        "Öğleden sonra arkadaşımla sinemaya gittik. Film çok güzeldi. Akşam eve otobüsle döndüm. Saat on bir buçukta yattım.",
      questions: [
        mcq("u3r1", "Dün hangi gündü?", ["Pazar", "Cuma", "Cumartesi", "Pazartesi"], 2, "«Dün cumartesiydi» — есімді өткен шақ.", [72]),
        mcq("u3r2", "Saat kaçta pazara gitti?", ["10.15", "9.45", "10.30", "8.00"], 0, "«onu çeyrek geçe» = 10.15.", [56]),
        tf("u3r3", "İki kilo elma aldı.", false, "Екі келі қызанақ, бір келі алма алды.", [64]),
        mcq("u3r4", "Eve nasıl döndü?", ["Otobüsle", "Taksiyle", "Metroyla", "Trenle"], 0, "«eve otobüsle döndüm» — -lA құрал.", [60]),
        tf("u3r5", "Film güzeldi.", true, "«Film çok güzeldi».", [71]),
      ],
    },
    listening: {
      title: "Manavda",
      lines: [
        A("Satıcı", "Hoş geldiniz, buyurun!"),
        B("Müşteri", "Kolay gelsin. Patatesin kilosu kaç lira?"),
        A("Satıcı", "Patatesin kilosu sekiz lira."),
        B("Müşteri", "İki kilo patates istiyorum. Limon var mı?"),
        A("Satıcı", "Var. Limonun kilosu on iki lira."),
        B("Müşteri", "Bir kilo limon da alayım. Borcum ne kadar?"),
        A("Satıcı", "Yirmi sekiz lira."),
        B("Müşteri", "Buyurun, otuz lira."),
        A("Satıcı", "Paranızın üstü iki lira. Hayırlı olsun!"),
      ],
      questions: [
        mcq("u3l1", "Patatesin kilosu kaç lira?", ["Altı", "Sekiz", "On iki", "Yirmi"], 1, "«Patatesin kilosu sekiz lira».", [64]),
        mcq("u3l2", "Müşteri kaç kilo patates alıyor?", ["Bir", "İki", "Üç", "Dört"], 1, "«İki kilo patates istiyorum».", [64]),
        mcq("u3l3", "Müşterinin borcu ne kadar?", ["Yirmi lira", "Yirmi sekiz lira", "Otuz lira", "İki lira"], 1, "2×8 + 12 = 28 лира.", [64, 67]),
        tf("u3l4", "Müşteri limon almıyor.", false, "«Bir kilo limon da alayım» — алады.", [64]),
      ],
      dictation: ["Patatesin kilosu kaç lira?", "Borcum ne kadar?", "Saat on buçuk.", "Dün sinemaya gittim."],
    },
    grammar: [
      mcq("u3g1", "Dün okula git___.", ["tim", "iyorum", "eceğim", "mek"], 0, "dün → өткен шақ -DI; git + -ti (қатаң t).", [58]),
      mcq("u3g2", "Saat 7.45", ["Sekize çeyrek var.", "Sekizi çeyrek geçiyor.", "Yedi buçuk.", "Sekiz."], 0, "Қалған минут: барыс + var → Sekize çeyrek var.", [56]),
      mcq("u3g3", "Saat 3.10'da buluşalım → Saat ___ buluşalım.", ["üçü on geçe", "üçe on kala", "üç onda", "üçü on geçiyor"], 0, "«...да» мағынасында: табыс + geçe.", [56]),
      mcq("u3g4", "Okula otobüs___ gidiyorum.", ["le", "la", "de", "e"], 0, "otobüs (ü) → -le.", [60]),
      mcq("u3g5", "Şeker___ çay içiyorum. (қантсыз)", ["siz", "li", "lik", "de"], 0, "-sIz «-сыз/-сіз».", [61]),
      mcq("u3g6", "Dün kitap okudun ___?", ["mu", "mı", "mi", "mü"], 0, "okudun (u) → mu.", [58]),
      mcq("u3g7", "Hava dün çok güzel___.", ["di", "dı", "du", "dü"], 0, "güzel (e) → -di.", [62]),
      mcq("u3g8", "Tuz___ masada. (тұздық)", ["luk", "lu", "suz", "la"], 0, "-lIk — арналған зат: tuzluk.", [61]),
    ],
    writing: [
      { id: "u3w1", tr: "Dün ne yaptınız? Anlatın.", kz: "Кеше не істедіңіз? (белгілі өткен шақ)", minSentences: 6, focus: "-DI, saat", pages: [58, 59] },
      { id: "u3w2", tr: "Pazarda bir alışveriş diyaloğu yazın.", kz: "Базардағы сауда диалогын жазыңыз.", minSentences: 6, focus: "Kaç lira? Ne kadar?", pages: [64, 66] },
    ],
    speaking: { topic: "Günlük hayat ve alışveriş", kz: "Күнделікті өмір және сауда", pages: [56, 58, 64, 72], questions: ["Saat kaçta uyanıyorsunuz?", "Dün ne yaptınız?", "Kahvaltıda ne yiyorsunuz?", "Pazardan ne alıyorsunuz?", "En çok hangi mevsimi seviyorsunuz?"] },
  },
  {
    unit: 4,
    reading: {
      title: "Mahallem",
      text:
        "Benim mahallem çok güzel. Evimiz Gül Sokağı'nda. Apartmanımız dört katlı, bizim dairemiz üçüncü katta. " +
        "Apartmanın önünde büyük bir park var. Parkın yanında bir fırın ve bir eczane var. Fırının karşısında bir market var. " +
        "Okulum evime yakın; evden okula kadar on dakika yürüyorum. Gelecek hafta mahallemizde bir pazar açılacak. Annem ve ben pazara gideceğiz.",
      questions: [
        mcq("u4r1", "Daireleri kaçıncı katta?", ["Birinci", "İkinci", "Üçüncü", "Dördüncü"], 2, "«dairemiz üçüncü katta».", [78]),
        tf("u4r2", "Parkın yanında bir eczane var.", true, "«Parkın yanında bir fırın ve bir eczane var».", [84]),
        mcq("u4r3", "Market nerede?", ["Fırının karşısında", "Parkın içinde", "Okulun yanında", "Evin arkasında"], 0, "«Fırının karşısında bir market var».", [80, 84]),
        mcq("u4r4", "Evden okula kaç dakika yürüyor?", ["Beş", "On", "On beş", "Yirmi"], 1, "«evden okula kadar on dakika» — -DAn ... -A kadar.", [87]),
        tf("u4r5", "Gelecek hafta mahallede bir sinema açılacak.", false, "Кинотеатр емес, базар ашылады.", [89]),
      ],
    },
    listening: {
      title: "Eczane Nerede?",
      lines: [
        A("Turist", "Affedersiniz, eczane nerede?"),
        B("Kadın", "İleriye gidin. Sonra sağa dönün. Eczane bankanın yanında."),
        A("Turist", "Uzak mı?"),
        B("Kadın", "Hayır, uzak değil. Yaklaşık iki yüz metre."),
        A("Turist", "Postane de orada mı?"),
        B("Kadın", "Evet, postane eczanenin karşısında."),
        A("Turist", "Çok teşekkür ederim."),
        B("Kadın", "Rica ederim."),
      ],
      questions: [
        mcq("u4l1", "Eczane nerede?", ["Bankanın yanında", "Parkın içinde", "Okulun arkasında", "Postanenin içinde"], 0, "«Eczane bankanın yanında».", [84, 86]),
        mcq("u4l2", "Eczane kaç metre uzakta?", ["Yüz", "İki yüz", "Beş yüz", "Bin"], 1, "«Yaklaşık iki yüz metre».", [85]),
        mcq("u4l3", "Postane nerede?", ["Eczanenin karşısında", "Bankanın arkasında", "Sağda", "Uzakta"], 0, "«postane eczanenin karşısında».", [80]),
        tf("u4l4", "Eczane çok uzak.", false, "«Hayır, uzak değil».", [86]),
      ],
      dictation: ["Affedersiniz, eczane nerede?", "Sağa dönün.", "Postane eczanenin karşısında.", "Rica ederim."],
    },
    grammar: [
      mcq("u4g1", "senin + araba →", ["araban", "arabam", "arabası", "arabanız"], 0, "2-жақ жекеше тәуелдік: -n.", [82]),
      mcq("u4g2", "bizim + ev →", ["evimiz", "eviniz", "evleri", "evim"], 0, "1-жақ көпше: -(I)mIz.", [82]),
      mcq("u4g3", "Таңнан кешке дейін жұмыс істеймін.", ["Sabahtan akşama kadar çalışıyorum.", "Sabahta akşamda kadar çalışıyorum.", "Sabaha akşamdan kadar çalışıyorum.", "Sabahın akşamın kadar çalışıyorum."], 0, "-DAn ... -(y)A kadar.", [87, 88]),
      mcq("u4g4", "Yarın sinemaya git___.", ["eceğim", "tim", "iyordum", "mek"], 0, "yarın → келер шақ: git → gid-eceğim.", [89]),
      mcq("u4g5", "Onlar gelecek hafta İstanbul'a ___.", ["gidecekler", "gitti", "gidiyorum", "gideceğiz"], 0, "onlar + келер шақ → gidecekler.", [89]),
      mcq("u4g6", "Kitap masanın ___. (үстінде)", ["üstünde", "altında", "önünde", "arkasında"], 0, "üst «үсті» + -ü + -nde.", [84]),
      mcq("u4g7", "Ben yarın çalış___. (жұмыс істемеймін)", ["mayacağım", "mıyacağım", "madım", "mıyorum"], 0, "Болымсыз келер шақ: -mAyAcAk.", [89]),
      mcq("u4g8", "onların + ev →", ["evleri", "evi", "evimiz", "evin"], 0, "3-жақ көпше: -lArI.", [82]),
    ],
    writing: [
      { id: "u4w1", tr: "Mahallenizi anlatın: ne var, nerede?", kz: "Маһаллаңызды сипаттаңыз: не бар, қайда?", minSentences: 6, focus: "önünde, yanında, karşısında", pages: [80, 83, 84] },
      { id: "u4w2", tr: "Gelecek hafta ne yapacaksınız?", kz: "Келесі аптада не істейсіз? (келер шақ)", minSentences: 6, focus: "-(y)AcAk", pages: [89, 93] },
    ],
    speaking: { topic: "Çevremiz ve planlarımız", kz: "Айнала және жоспар", pages: [78, 84, 86, 89], questions: ["Nerede oturuyorsunuz?", "Evinizin yanında ne var?", "Okulunuz evinize yakın mı?", "Yarın ne yapacaksınız?", "Hafta sonu planınız ne?"] },
  },
  {
    unit: 5,
    reading: {
      title: "Teyzemin Mesleği",
      text:
        "Teyzemin adı Saule. O bir hemşire. Şehir hastanesinde çalışıyor. Her sabah saat yedide işe gidiyor. " +
        "Hastaların ateşini ölçüyor ve onlara ilaç veriyor. Teyzemin işi zor ama o mesleğini çok seviyor. " +
        "Teyzemin kocası Nurlan bir aşçı. Onun lokantası şehrin merkezinde. Teyzemin hobisi çiçekler; boş zamanında bahçede çiçek yetiştiriyor. " +
        "Ben de gelecekte doktor olmak istiyorum.",
      questions: [
        mcq("u5r1", "Saule ne iş yapıyor?", ["Doktor", "Hemşire", "Aşçı", "Öğretmen"], 1, "«O bir hemşire».", [106]),
        mcq("u5r2", "Saule nerede çalışıyor?", ["Okulda", "Lokantada", "Hastanede", "Bahçede"], 2, "«Şehir hastanesinde çalışıyor».", [106]),
        tf("u5r3", "Nurlan bir doktor.", false, "Нұрлан — aşçı (аспаз).", [110]),
        mcq("u5r4", "Saule'nin hobisi ne?", ["Kitap okumak", "Çiçek yetiştirmek", "Yüzmek", "Balık tutmak"], 1, "«bahçede çiçek yetiştiriyor».", [111]),
        mcq("u5r5", "Yazar ne olmak istiyor?", ["Hemşire", "Aşçı", "Doktor", "Mimar"], 2, "«doktor olmak istiyorum».", [105]),
      ],
    },
    listening: {
      title: "Doktorda",
      lines: [
        A("Doktor", "Geçmiş olsun. Şikâyetiniz ne?"),
        B("Hasta", "Başım ağrıyor ve boğazım acıyor."),
        A("Doktor", "Ateşiniz var mı?"),
        B("Hasta", "Evet, biraz ateşim var."),
        A("Doktor", "Ağzınızı açın, lütfen. Bu bir soğuk algınlığı. Size ilaç yazıyorum."),
        B("Hasta", "Teşekkür ederim. Ne zaman tekrar geleyim?"),
        A("Doktor", "Bir hafta sonra gelin. Bol su için."),
      ],
      questions: [
        mcq("u5l1", "Hastanın şikâyeti ne?", ["Karnı ağrıyor", "Başı ağrıyor, boğazı acıyor", "Ayağı ağrıyor", "Gözü ağrıyor"], 1, "«Başım ağrıyor ve boğazım acıyor».", [106, 107]),
        tf("u5l2", "Hastanın ateşi yok.", false, "«biraz ateşim var».", [106]),
        mcq("u5l3", "Hasta neden hasta?", ["Soğuk algınlığı", "Kaza", "Diş ağrısı", "Göz hastalığı"], 0, "«Bu bir soğuk algınlığı».", [106]),
        mcq("u5l4", "Hasta ne zaman tekrar gelecek?", ["Yarın", "Üç gün sonra", "Bir hafta sonra", "Bir ay sonra"], 2, "«Bir hafta sonra gelin».", [106]),
      ],
      dictation: ["Başım ağrıyor.", "Ateşiniz var mı?", "Size ilaç yazıyorum.", "Bol su için."],
    },
    grammar: [
      mcq("u5g1", "Ali + araba (белгілі ілік топ)", ["Ali'nin arabası", "Ali arabası", "Ali'nin araba", "Ali'yi arabası"], 0, "-(n)In + -(s)I: Ali'nin arabası.", [99]),
      mcq("u5g2", "okul + kapı (белгісіз ілік топ)", ["okul kapısı", "okulun kapı", "okul kapı", "okulu kapısı"], 0, "Белгісіз топ: тек 2-сөзге -(s)I.", [101]),
      mcq("u5g3", "kitap + kapak (белгілі)", ["kitabın kapağı", "kitapın kapakı", "kitabın kapak", "kitap kapağı"], 0, "p → b, k → ğ: kitabın kapağı.", [99]),
      mcq("u5g4", "su + renk (белгілі)", ["suyun rengi", "sunun rengi", "suyın rengi", "su rengin"], 0, "su ерекше: suyun.", [101]),
      mcq("u5g5", "Mektupları kim getiriyor?", ["Postacı", "Aşçı", "Berber", "Terzi"], 0, "postacı — пошташы.", [109]),
      mcq("u5g6", "Elbiseyi kim dikiyor?", ["Terzi", "Pilot", "Eczacı", "Kaptan"], 0, "terzi — тігінші.", [102]),
      mcq("u5g7", "doktor → мамандықтың аты", ["doktorluk", "doktorlu", "doktorsuz", "doktorcu"], 0, "-lIk абстракт есім: doktorluk.", [105]),
      mcq("u5g8", "Ben kitap okuma___ seviyorum.", ["yı", "ya", "da", "dan"], 0, "-mAyI sevmek: okumayı.", [112]),
    ],
    writing: [
      { id: "u5w1", tr: "Ailenizden birinin mesleğini anlatın.", kz: "Отбасыңыздағы біреудің мамандығын сипаттаңыз.", minSentences: 6, focus: "İsim tamlaması, -Iyor", pages: [98, 104, 109] },
      { id: "u5w2", tr: "Hobilerinizi yazın.", kz: "Хоббилеріңізді жазыңыз (-mAyI seviyorum).", minSentences: 5, focus: "-mAyI sevmek", pages: [111, 112] },
    ],
    speaking: { topic: "Meslekler ve hobiler", kz: "Мамандықтар мен хоббилер", pages: [98, 103, 105, 111], questions: ["Ne olmak istiyorsunuz?", "Bu mesleği neden seviyorsunuz?", "Hobileriniz neler?", "Boş zamanınızda ne yapıyorsunuz?", "Doktora en son ne zaman gittiniz?"] },
  },
  {
    unit: 6,
    reading: {
      title: "İlk Uçak Yolculuğum",
      text:
        "Geçen yaz ilk defa uçağa bindim. Almatı'dan İstanbul'a gittim. Uçak saat on dörtte kalktı ve yolculuk beş saat sürdü. " +
        "Hostesler çok kibardı. Pencere kenarında oturdum ve bulutları seyrettim. İstanbul'da hava çok sıcaktı. " +
        "Havaalanından otele metroyla gittim. Otelim Taksim'deydi. Otelin üçüncü katındaki odam küçük ama temizdi.",
      questions: [
        mcq("u6r1", "Nereye gitti?", ["Ankara'ya", "İstanbul'a", "Almatı'ya", "Antalya'ya"], 1, "«Almatı'dan İstanbul'a gittim».", [118]),
        mcq("u6r2", "Yolculuk kaç saat sürdü?", ["İki", "Üç", "Beş", "On dört"], 2, "«yolculuk beş saat sürdü».", [122]),
        tf("u6r3", "İstanbul'da hava soğuktu.", false, "«hava çok sıcaktı».", [128]),
        mcq("u6r4", "Otele nasıl gitti?", ["Taksiyle", "Otobüsle", "Metroyla", "Yürüyerek"], 2, "«otele metroyla gittim».", [124]),
        mcq("u6r5", "Odası kaçıncı katta?", ["Birinci", "İkinci", "Üçüncü", "Beşinci"], 2, "«üçüncü katındaki odam» — -DAki.", [119, 127]),
      ],
    },
    listening: {
      title: "Yarın Hava Nasıl Olacak?",
      lines: [
        A("Sunucu", "İyi akşamlar. Yarın Ankara'da hava bulutlu olacak. Sıcaklık on beş derece."),
        A("Sunucu", "İstanbul'da yağmur yağacak, sıcaklık on sekiz derece."),
        A("Sunucu", "Antalya'da hava güneşli ve sıcak olacak, sıcaklık yirmi sekiz derece."),
        A("Sunucu", "Erzurum'da kar yağacak, sıcaklık eksi üç derece. Hepinize iyi akşamlar."),
      ],
      questions: [
        mcq("u6l1", "Yarın Ankara'da hava nasıl olacak?", ["Güneşli", "Bulutlu", "Karlı", "Rüzgârlı"], 1, "«Ankara'da hava bulutlu olacak».", [128, 129]),
        mcq("u6l2", "İstanbul'da hava nasıl olacak?", ["Yağmurlu", "Güneşli", "Karlı", "Sisli"], 0, "«İstanbul'da yağmur yağacak».", [129]),
        mcq("u6l3", "Antalya'da sıcaklık kaç derece?", ["On beş", "On sekiz", "Yirmi sekiz", "Eksi üç"], 2, "«yirmi sekiz derece».", [130]),
        tf("u6l4", "Erzurum'da kar yağacak.", true, "«Erzurum'da kar yağacak».", [128]),
      ],
      dictation: ["Yarın hava bulutlu olacak.", "İstanbul'da yağmur yağacak.", "Uçak saat on dörtte kalktı.", "Otelim Taksim'deydi."],
    },
    grammar: [
      mcq("u6g1", "Masa___ kitap kimin? (үстелдегі)", ["daki", "da", "nın", "ki"], 0, "-DAki: masadaki.", [119]),
      mcq("u6g2", "Dün___ film güzeldi. (кешегі)", ["kü", "ki", "deki", "e"], 0, "dün → dünkü (ерекше).", [119]),
      mcq("u6g3", "Benim kalemim burada, ___ nerede? (сенікі)", ["seninki", "senin", "sende", "senki"], 0, "Ілік + -ki: seninki.", [120]),
      mcq("u6g4", "4 → реттік сан", ["dördüncü", "dörtüncü", "dörtinci", "dördinci"], 0, "t → d: dördüncü.", [27, 127]),
      mcq("u6g5", "9 → реттік сан", ["dokuzuncu", "dokuzinci", "dokuzıncı", "dokuzuncı"], 0, "dokuz (u) → -uncu.", [27]),
      mcq("u6g6", "Kaçıncı katta oturuyorsun? — ___ katta.", ["Beşinci", "Beş", "Beşte", "Beşli"], 0, "kaçıncı? → реттік сан.", [127]),
      mcq("u6g7", "Kışın hava ___.", ["soğuk", "bunaltıcı", "çok sıcak", "güneşli ve sıcak"], 0, "Қыс — суық.", [130]),
      mcq("u6g8", "Hava ___, şemsiyeni al!", ["yağmurlu", "güneşli", "sıcak", "açık"], 0, "Қолшатыр → жаңбырлы.", [128]),
    ],
    writing: [
      { id: "u6w1", tr: "Bir yolculuğunuzu anlatın.", kz: "Бір сапарыңызды сипаттаңыз.", minSentences: 6, focus: "-DI, -DAki, -(I)ncI", pages: [118, 123] },
      { id: "u6w2", tr: "Hangi mevsimi seviyorsunuz? Neden?", kz: "Қай мезгілді ұнатасыз? Неге?", minSentences: 5, focus: "Hava durumu", pages: [129, 130] },
    ],
    speaking: { topic: "Ulaşım ve hava durumu", kz: "Көлік және ауа райы", pages: [118, 124, 125, 128], questions: ["Okula nasıl gidiyorsunuz?", "Hiç uçağa bindiniz mi?", "Bugün hava nasıl?", "En sevdiğiniz mevsim hangisi?", "Tatilde nereye gitmek istiyorsunuz?"] },
  },
  {
    unit: 7,
    reading: {
      title: "Telefon mu, Mektup mu?",
      text:
        "Dedemin gençliğinde cep telefonu yoktu. İnsanlar mektup yazdı ve postacıyı bekledi. Bir mektup haftalarca yolda kaldı. " +
        "Bugün iletişim çok daha kolay ve hızlı. Ben kardeşimle her gün telefonla konuşuyorum. Bilgisayardan e-posta gönderiyorum. " +
        "Bence internet en hızlı iletişim aracı. Ama dedeme göre mektup daha güzel, çünkü mektup güzel bir anı. " +
        "Ben üç yıldan beri bir arkadaşımla mektuplaşıyorum.",
      questions: [
        tf("u7r1", "Dedenin gençliğinde cep telefonu vardı.", false, "«cep telefonu yoktu».", [138, 139]),
        mcq("u7r2", "Yazara göre en hızlı iletişim aracı hangisi?", ["Mektup", "Telefon", "İnternet", "Güvercin"], 2, "«Bence internet en hızlı iletişim aracı» — en + сын есім.", [144, 146]),
        mcq("u7r3", "Dedeye göre hangisi daha güzel?", ["Mektup", "E-posta", "Telefon", "İnternet"], 0, "«dedeme göre mektup daha güzel».", [144]),
        mcq("u7r4", "Yazar kaç yıldan beri mektuplaşıyor?", ["Bir", "İki", "Üç", "Beş"], 2, "«üç yıldan beri» — -DAn beri.", [151]),
        tf("u7r5", "Yazar kardeşiyle her gün telefonla konuşuyor.", true, "«her gün telefonla konuşuyorum».", [139]),
      ],
    },
    listening: {
      title: "Telefonda",
      lines: [
        A("Ayşe", "Alo, iyi günler. Ben Ayşe. Mehmet Bey orada mı?"),
        B("Sekreter", "İyi günler. Maalesef Mehmet Bey şu anda toplantıda."),
        A("Ayşe", "Ne zaman dönecek?"),
        B("Sekreter", "Saat üçte dönecek. Bir mesajınız var mı?"),
        A("Ayşe", "Evet. Lütfen beni arasın. Telefon numaram sıfır beş yüz otuz iki, yüz kırk beş, altmış yedi, seksen dokuz."),
        B("Sekreter", "Tamam, not ettim. İyi günler."),
      ],
      questions: [
        mcq("u7l1", "Mehmet Bey şu anda nerede?", ["Evde", "Toplantıda", "Tatilde", "Yolda"], 1, "«şu anda toplantıda».", [140]),
        mcq("u7l2", "Mehmet Bey ne zaman dönecek?", ["Saat ikide", "Saat üçte", "Saat beşte", "Yarın"], 1, "«Saat üçte dönecek».", [140]),
        tf("u7l3", "Ayşe mesaj bırakmıyor.", false, "«Lütfen beni arasın» — хабар қалдырады.", [141]),
        mcq("u7l4", "Ayşe'nin numarası hangi sayılarla bitiyor?", ["67 89", "45 67", "89 67", "32 45"], 0, "«...altmış yedi, seksen dokuz» → 67 89.", [27]),
      ],
      dictation: ["Mehmet Bey orada mı?", "Saat üçte dönecek.", "Lütfen beni arasın.", "İnternet en hızlı iletişim aracı."],
    },
    grammar: [
      mcq("u7g1", "Uçak, otobüsten daha ___.", ["hızlı", "yavaş", "ağır", "eski"], 0, "-DAn daha + сын есім: салыстыру.", [141, 143]),
      mcq("u7g2", "Everest dünyanın ___ yüksek dağı.", ["en", "daha", "çok", "den"], 0, "Асырмалы шырай: en yüksek.", [146]),
      mcq("u7g3", "Ali, Ayşe'___ daha uzun.", ["den", "de", "ye", "nin"], 0, "Салыстыру — шығыс септігі: Ayşe'den.", [143]),
      mcq("u7g4", "2015 yılı___ beri Ankara'dayım.", ["ndan", "nda", "na", "dır"], 0, "yılı + n + dan beri.", [151]),
      mcq("u7g5", "Üç yıl___ Türkçe öğreniyorum.", ["dır", "dan", "da", "a"], 0, "-DIr уақыт ұзақтығы: üç yıldır.", [151, 152]),
      mcq("u7g6", "Ban___ göre bu film güzel.", ["a", "e", "da", "den"], 0, "ben → bana göre.", [144]),
      mcq("u7g7", "Kardeşim benden üç yaş daha ___.", ["küçük", "en küçük", "küçükten", "küçüklük"], 0, "daha + сын есім.", [143]),
      mcq("u7g8", "Sınıfın ___ çalışkan öğrencisi Ali.", ["en", "daha", "-den", "çok daha"], 0, "Ең → en.", [146]),
    ],
    writing: [
      { id: "u7w1", tr: "Bir arkadaşınıza mesaj yazın: buluşma yeri ve saati.", kz: "Досыңызға хабарлама жазыңыз: кездесу орны мен уақыты.", minSentences: 4, focus: "Yer tarifi, saat", pages: [141] },
      { id: "u7w2", tr: "İnternetin faydaları ve zararları nelerdir?", kz: "Интернеттің пайдасы мен зияны.", minSentences: 6, focus: "daha / en, bence", pages: [147] },
    ],
    speaking: { topic: "İletişim", kz: "Байланыс", pages: [138, 139, 144, 150], questions: ["Arkadaşlarınızla nasıl haberleşiyorsunuz?", "İnterneti ne için kullanıyorsunuz?", "Ne zamandan beri Türkçe öğreniyorsunuz?", "Size göre en iyi iletişim aracı hangisi?", "Doğum gününüzü nasıl kutluyorsunuz?"] },
  },
  {
    unit: 8,
    reading: {
      title: "Bayram Sabahı",
      text:
        "Bugün Ramazan Bayramı. Sabah erken kalktık. Babam ve ağabeyim bayram namazına gittiler. Annem ve ben kahvaltıyı hazırladık. " +
        "Namazdan sonra hep birlikte dedemin evine gittik. Dedemin ve ninemin elini öptük. Dedem bize bayram harçlığı verdi. " +
        "Ninem masaya baklava ve şeker koydu. Öğleden sonra komşularımızı ziyaret ettik. Akşam çok yorulduk ama çok mutluyduk.",
      questions: [
        mcq("u8r1", "Hangi bayram?", ["Kurban Bayramı", "Ramazan Bayramı", "Yılbaşı", "Nevruz"], 1, "«Bugün Ramazan Bayramı».", [166, 172]),
        tf("u8r2", "Anne bayram namazına gitti.", false, "Намазға әкесі мен ағасы барды.", [172]),
        mcq("u8r3", "Namazdan sonra kimin evine gittiler?", ["Komşunun", "Dedenin", "Teyzenin", "Öğretmenin"], 1, "«dedemin evine gittik».", [166]),
        mcq("u8r4", "Dede ne verdi?", ["Baklava", "Kitap", "Bayram harçlığı", "Çiçek"], 2, "«bayram harçlığı verdi».", [166]),
        tf("u8r5", "Akşam çok mutluydular.", true, "«çok mutluyduk».", [172]),
      ],
    },
    listening: {
      title: "Hafta Sonu Planı",
      lines: [
        A("Deniz", "Bu hafta sonu ne yapıyorsun?"),
        B("Ahmet", "Cumartesi günü Kapadokya'ya gideceğim. Balona bineceğim."),
        A("Deniz", "Harika! Ne zaman döneceksin?"),
        B("Ahmet", "Pazar akşamı döneceğim. Sen ne yapacaksın?"),
        A("Deniz", "Ben ailemle pikniğe gideceğim. Hava güneşli olacak."),
        B("Ahmet", "İyi eğlenceler!"),
      ],
      questions: [
        mcq("u8l1", "Ahmet nereye gidecek?", ["Antalya'ya", "Kapadokya'ya", "Amasra'ya", "Büyükada'ya"], 1, "«Kapadokya'ya gideceğim».", [157]),
        mcq("u8l2", "Ahmet ne zaman dönecek?", ["Cumartesi sabahı", "Pazar akşamı", "Pazartesi", "Cuma akşamı"], 1, "«Pazar akşamı döneceğim».", [157]),
        mcq("u8l3", "Deniz ne yapacak?", ["Balona binecek", "Pikniğe gidecek", "Evde kalacak", "Yüzecek"], 1, "«ailemle pikniğe gideceğim».", [161]),
        tf("u8l4", "Hava yağmurlu olacak.", false, "«Hava güneşli olacak».", [129]),
      ],
      dictation: ["Bu hafta sonu ne yapıyorsun?", "Balona bineceğim.", "Bayramınız kutlu olsun!", "Hava güneşli olacak."],
    },
    grammar: [
      mcq("u8g1", "Dün sinemaya git___.", ["tim", "eceğim", "iyorum", "mek"], 0, "dün → -DI.", [58]),
      mcq("u8g2", "Şimdi kitap ___.", ["okuyorum", "okudum", "okuyacağım", "okumak"], 0, "şimdi → нақ осы шақ.", [44]),
      mcq("u8g3", "Yarın Antalya'ya ___.", ["gideceğim", "gittim", "gidiyordum", "gitmek"], 0, "yarın → келер шақ.", [89]),
      mcq("u8g4", "Elif ev___ dışarı çıkıyor.", ["den", "de", "e", "i"], 0, "Шығу → -DAn.", [51, 173]),
      mcq("u8g5", "Saat 2.20", ["İkiyi yirmi geçiyor.", "İkiye yirmi var.", "İki yirmi kala.", "İki buçuk."], 0, "Өткен минут: табыс + geçiyor.", [56]),
      mcq("u8g6", "3 → реттік сан", ["üçüncü", "üçünci", "üçıncı", "üçinci"], 0, "üç (ü) → -üncü.", [27]),
      mcq("u8g7", "İstanbul, Türkiye'nin ___ kalabalık şehri.", ["en", "daha", "çok daha", "den"], 0, "en + сын есім.", [146]),
      mcq("u8g8", "Bayramınız ___ olsun!", ["kutlu", "kutlama", "kutlamak", "kutluyor"], 0, "Тұрақты тілек: Bayramınız kutlu olsun.", [167]),
    ],
    writing: [
      { id: "u8w1", tr: "Bir arkadaşınıza bayram tebrik kartı yazın.", kz: "Досыңызға мейрам құттықтау ашықхатын жазыңыз.", minSentences: 4, focus: "Kutlama ifadeleri", pages: [168] },
      { id: "u8w2", tr: "Hafta sonu planınızı yazın.", kz: "Демалыс жоспарыңызды жазыңыз (келер шақ).", minSentences: 6, focus: "-(y)AcAk, zaman", pages: [157, 161] },
    ],
    speaking: { topic: "Tatil ve bayram", kz: "Демалыс және мейрам", pages: [156, 162, 166, 171], questions: ["Ülkenizde hangi bayramlar var?", "Bayramlarda ne yapıyorsunuz?", "Geçen tatilde ne yaptınız?", "Bu hafta sonu ne yapacaksınız?", "Yazın nereye gitmek istiyorsunuz?"] },
  },
];

export const practiceForUnit = (unit: number) => PRACTICE.find((p) => p.unit === unit);
