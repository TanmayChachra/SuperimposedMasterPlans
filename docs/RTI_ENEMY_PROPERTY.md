# RTI draft: enemy property (Shatru Sampatti) plot lists

Purpose: get plot-level lists (village and khasra) for Ghaziabad, Meerut, Baghpat and Gautam Buddha Nagar, so the Plot info card can check a plot against them. The Ministry of Home Affairs page https://enemyproperty.mha.gov.in/epweb/immovableEnemyProperty only shows counts per district (Ghaziabad 30, Meerut 126, Baghpat 44, Gautam Buddha Nagar 74 plots on 2026-10-30), marked "tentative".

How to file
- Central: online at https://rtionline.gov.in, Ministry of Home Affairs, fee Rs 10. Ask for the Public Information Officer of the Custodian of Enemy Property for India (CEPI). Use the address on the Contact Us page of the CEPI site if you file on paper.
- District: a second application to the District Magistrate, Ghaziabad (and the other three districts if wanted), through the UP RTI portal or on paper, asking for the same list as held by the district office.
- Keep the reply as a scan and type it into `mpm/data/enemy_property.json` (format below). The site never shows owner or custodian-case details, only village, khasra and source.

## Application text (English)

To,
The Central Public Information Officer,
Custodian of Enemy Property for India, Ministry of Home Affairs, Government of India

Subject: Information under Section 6(1) of the RTI Act, 2005: list of immovable enemy properties

Sir or Madam,

Your website (enemyproperty.mha.gov.in, "Immovable Enemy Properties") lists the number of enemy property plots district-wise, for example Ghaziabad 30, Meerut 126, Baghpat 44 and Gautam Buddha Nagar 74 in Uttar Pradesh. Please provide, in electronic form (Excel or PDF), for these four districts:

1. The list of every immovable enemy property plot vested in the Custodian, giving district, tehsil, village (or mohalla), khasra / gata / plot number, and area.
2. For each, the current status in one word (vested, under examination, sold or auctioned, encroached, other).
3. The date up to which this list is current.
4. If the plot-wise list is already published anywhere (website, gazette or notice), the exact link or reference.

I do not need names of the original owners or details of court cases. I have paid the application fee of Rs 10.

Date and place:
Name and address:
Mobile and email:

## Short version for the district office

To, The Public Information Officer, Office of the District Magistrate, Ghaziabad

Please provide the list of plots recorded as enemy property (Shatru Sampatti) in district Ghaziabad, with tehsil, village, khasra number, area and present status, and the date up to which the list is current. Names of former owners are not needed.

## Hindi (district office)

सेवा में, जन सूचना अधिकारी, जिलाधिकारी कार्यालय, गाजियाबाद

विषय: सूचना का अधिकार अधिनियम 2005 की धारा 6(1) के अंतर्गत शत्रु संपत्ति की सूची

कृपया जनपद गाजियाबाद में शत्रु संपत्ति के रूप में दर्ज सभी भूखंडों की सूची तहसील, ग्राम, खसरा/गाटा संख्या, क्षेत्रफल और वर्तमान स्थिति सहित उपलब्ध कराएं, तथा यह भी बताएं कि सूची किस तिथि तक की है। पूर्व स्वामियों के नाम आवश्यक नहीं हैं।

दिनांक और स्थान:
नाम और पता:
मोबाइल:

## Data file format (`mpm/data/enemy_property.json`)

```json
{"asOf": "2026-12-01", "items": [
  {"code": "119656", "village": "Nahali", "khasra": "1045", "source": "CEPI RTI reply, 2026-12-01"}
]}
```

`code` is the Bhulekh village code (see `mpm/data/bhulekh_villages.json`). The card matches on code or village name. An exact khasra match shows red. A match on the base number only (1045 vs 1045/2) shows amber. With no items the card says "list not loaded" and never says "clear".
