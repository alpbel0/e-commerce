# E-Commerce Analytics Platform

## Proje Ozeti

Bu proje, bir okul projesi kapsaminda gelistirilen **E-Commerce Analytics Platform with Multi-Agent Text2SQL AI Chatbot** calismasidir.

Amac, farkli Kaggle veri setlerinden gelen e-ticaret verilerini tek bir iliskisel veritabaninda birlestirmek, bu veri uzerinde rol bazli analitik ekranlar sunmak ve kullanicilarin dogal dil ile SQL tabanli analiz yapabilmesini saglamaktir.

Bu proje bir production-grade urun degil, akademik olarak savunulabilir ve calisan bir prototip olarak tasarlanmistir.

## Temel Hedefler

- 6 farkli veri setini ETL sureci ile birlestirmek
- PostgreSQL tabanli normalize bir veri modeli kurmak
- `ADMIN`, `CORPORATE`, `INDIVIDUAL` rollerini desteklemek
- Spring Boot ile backend servislerini gelistirmek
- Angular ile dashboard ve uygulama arayuzunu gelistirmek
- Python + LangGraph ile Multi-Agent Text2SQL chatbot kurmak
- Rol bazli veri erisimi uygulamak

## Teknoloji Yigini

- Backend: `Spring Boot 3.4.x`
- Frontend: `Angular 20.x`
- Database: `PostgreSQL 17.x`
- AI Service: `Python 3.12`, `LangGraph 1.x`, `Chainlit`
- Authentication: `JWT`
- Migration: `Flyway`
- Build Tool: `Maven`

## Mimari Ozet

Proje 4 ana teknik alana ayrilmistir:

### 1. ETL ve Veri Entegrasyonu

- Ham veri setleri `etl/raw/` altinda tutulur
- Temizleme ve donusum asamalari `staging` katmaninda ele alinir
- Final veri `PostgreSQL` uzerindeki core semaya yuklenir
- Kaynak kimlikleri ile sistem kimlikleri arasinda mapping tablolari kullanilir

### 2. Backend

- Spring Boot ana uygulama katmanidir
- Auth, RBAC, urun, siparis, review, analytics ve chat endpointleri burada yer alir
- AI service ile haberlesme `WebClient` uzerinden yapilir

### 3. Frontend

- Angular tabanli role-aware arayuz
- Individual, Corporate ve Admin kullanicilar icin farkli ekran akislarina sahiptir
- Dashboard, urun, siparis, cart, analytics ve chat ekranlarini icerir

### 4. AI Service

- Ayrik Python servisi olarak calisir
- LangGraph tabanli multi-agent akisi kullanir
- Scope kontrolu, SQL uretimi, hata duzeltme, sonuc analizi ve gerekirse gorsellestirme yapar

## Kullanici Rolleri

### Individual User

- Urunleri goruntuler
- Sepet ve siparis akisini kullanir
- Kendi siparislerini ve harcama verilerini gorur
- Review yazabilir
- Kendi verisi uzerinde chatbot sorgulari calistirabilir

### Corporate User

- Kendi store verisini gorur
- Urun ve siparis yonetimi yapar
- Sales analytics ve customer insight ekranlarini kullanir
- Kendi store'u ile sinirli chatbot sorgulari calistirir

### Admin

- Tum sistem verisini gorebilir
- Kullanici, store ve kategori yonetimi yapar
- Platform genelindeki analytics ekranlarini kullanir
- Tum veri uzerinde chatbot sorgulari calistirabilir

## Veri Entegrasyonu Ozet Kararlari

- `Online Retail` veri setinde `CustomerID` bos olan satirlar dislanir
- `Train.csv` ile `orders` arasinda dogal key olmadigi icin shipment kayitlari seeded random 1-1 assignment ile baglanir
- `Amazon Reviews` icinde yalnizca mevcut `products` ile exact mapping yapilabilen review kayitlari yuklenir
- `Online Retail` urunleri `UNCATEGORIZED` category altina atanir
- `Online Retail` ve `Pakistan` veri setleri icin varsayilan sentetik store kayitlari kullanilir
- Buyuk veri setlerinde sample uygulanabilir; Amazon Reviews icin ilk `200,000` satir kullanilabilir

## Guvenlik ve Kisitlar

- Chatbot tarafinda uretilen SQL dogrudan tam yetkili kullanici ile calistirilmaz
- Sadece read-only database kullanicisi ile sorgu calistirilir
- Ilk surumde sadece `SELECT` sorgularina izin verilir
- Rol bazli veri erisimi backend ve AI katmaninda birlikte uygulanir

## Dokumanlar

Bu klasorde projeye ait temel teknik dokumanlar yer almaktadir:

- [HOMEWORK.md](C:\Users\yigit\Desktop\e-commerce\docs\HOMEWORK.md)
- [SQL.md](C:\Users\yigit\Desktop\e-commerce\docs\SQL.md)
- [DATA_INTEGRATION_PLAN.md](C:\Users\yigit\Desktop\e-commerce\docs\DATA_INTEGRATION_PLAN.md)
- [ROADMAP.md](C:\Users\yigit\Desktop\e-commerce\docs\ROADMAP.md)

## Mevcut Durum

Bu asamada proje tarafinda:

- veritabani semasi tanimlandi
- veri entegrasyon plani netlestirildi
- klasor yapisi ve gelistirme yaklasimi belirlendi
- roadmap olusturuldu

Bir sonraki ana odak:

- migration dosyasini gerceklestirmek
- ETL scriptlerini yazmak
- backend ve frontend iskeletini kurmak
- chatbot servisinin ilk calisan versiyonunu olusturmak

## Son Not

Bu proje bir e-ticaret sitesi klonundan ziyade, **veri entegrasyonu + rol bazli analitik + AI destekli sorgulama** fikrini gosteren akademik bir sistem olarak konumlandirilmistir.
