# Data sources: The River

All data lives in Iris (`https://iris-uat.chrisbarlow.nz`), reached through the Iris MCP server. Read tools need no sign-in. Write tools do.

## Where

| Thing | Name | Id |
|---|---|---|
| Collection | Barlow Family | `394b7942-823b-4e43-bed8-5418d976042a` |
| Set | Barlow Family Tree | `4a2f4562-c930-4fb8-a2cc-0862e6f040bf` |
| Package | People | `b07179e8-023a-4a64-821a-8cbe3f61edad` |
| Package | Families | `5e737dac-ea4f-4844-b4f5-65e902b4ebbf` |
| Package | Sources | `4fa7cc6f-87dd-4f59-b603-aeee418112bd` |
| Package | Model | `a62f18d1-441b-4f20-b081-ddaa770762b6` |

Origin: a MyHeritage GEDCOM export (Barlow Family Tree, exported 23 September 2026), with later research added by hand.

Size as exported on 18 November 2026: 561 elements, 13 diagrams. 449 people (109 flagged living), 101 families, 7 sources. The set description still says 214 people and 60 families; the tree has grown since through the Carter ancestry and Barlow research.

## The model

The tree is modelled in UML. A class diagram called "Genealogy Model" defines three classes. Every person, family and source is a UML object whose `data.classifier` names its class.

| Class | Link | To |
|---|---|---|
| Person | `partner` (with `data.gedcom_role` = HUSB or WIFE) | Family |
| Family | `child` (with `data.child_order`) | Person |
| Person | `cites` | Source |

So two people are never linked directly. A marriage is a Family object with two partner links, and children hang off the Family.

## A person record

Read from Iris on 18 November 2026. This is a 17th-century record with few fields. Others carry more.

```json
{
  "name": "Dorothy Barlow (wife of Ranulph)",
  "element_type": "object",
  "notation": "uml",
  "package_name": "People",
  "data": {
    "classifier": "Person",
    "type": "person",
    "gedcom_id": "I900138",
    "full_name": "Dorothy Barlow",
    "given_names": "Dorothy",
    "surname": "Barlow",
    "sex": "F",
    "is_deceased": true,
    "families_as_spouse": ["F900107"],
    "citations": [
      {
        "source": "Will of Randull Barlowe of Betley, 1639/40 (Staffordshire Record Office B/C/11)",
        "detail": "'Dorothy Barlowe, my loving and well beloved wife', residue and sole executrix"
      }
    ],
    "notes": ["..."]
  }
}
```

Per the set description, records can also carry:

- `data.primary_photo`: a canvas-ready `url` and a face-cropped `thumbnail_url`, hosted on Cloudinary (folder `barlow-family-tree`).
- `data.photos`: every GEDCOM photo with its MyHeritage provenance.
- `data.redactions`: what was removed. Email addresses of possibly-living people are redacted.

## What the build confirmed

The brief listed five things not yet known. Answers, from the full export:

| Question | Answer |
|---|---|
| Do records carry dates as fields? | Yes. `data.birth.date` and `data.death.date` are GEDCOM-style strings: `4 APR 1736`, `1871`, `ABT JUN 1979`, `21 MAR 1649/50`. 338 of 449 people have a birth year. Some have only `christening`, a `CHR` or `BAPM` event, or `burial`. The rest are estimated from parents, partners and children and drawn with a dashed ring. |
| Can places be grouped? | Yes, by keyword. `data.birth.place` and event places are free text ("St Augustine, Norwich, Norfolk, England", "Pirongia, Auckland, N.Z."). `pipeline/places.ts` sorts them into ten regions. About a third of people have a place. |
| Who is living? | `is_deceased` is on every Person except three. Two of those (Hugh Barlow c.1613 and Ranulph Barlow) are settled by their dates. The third has no date and is treated as living. |
| Where do the lines join? | Computed. The river is the ancestry of the youngest generation, and each join is a Family element. Six of the seven named lines are direct ancestors. Watkins is not: it joins through a marriage into a side branch. Only 40 of 101 families have a marriage date, so most joins are placed from the first child's birth. |
| How is certainty derived? | Three inputs, in order: a label on the child edge in the Full Family Tree diagram (`disputed`, `probable`, `mother unconfirmed`); `data.research.confidence` on the person or family; then citations. A citation to anything other than a compiled tree counts as a record. `data.source = "FamilySearch Family Tree"` with nothing else counts as compiled only. |

Other things worth knowing:

- People are keyed three ways. MyHeritage imports have `gedcom_id`. FamilySearch imports have `familysearch_id`. Two hand-made records (Hugh and Ranulph Barlow) have neither, and no `classifier`; they are found through diagram node ids (`P_I900106`).
- Families list partners and children in three shapes: objects with `gedcom_id`, plain FamilySearch id strings, and `husband_gedcom_id` / `wife_gedcom_id` / `children_gedcom_ids`.
- The GEDCOM puts a wife in the HUSB slot in at least one family. The build trusts `sex` over the slot.
- Diagram node colour is sex: pink for F, blue for M. Nothing else.
- The export has no relationships list. Everything needed is inside the Person and Family elements and the diagram edges.
- The Iris host cannot be reached from a browser or a cloud build. The site is built from an export file. See the README for the refresh steps.

## Diagrams in the set

| Diagram | Type | Nodes | Notes |
|---|---|---|---|
| Full Family Tree | UML class | 549 | Every person and family, one row per generation, oldest at the top |
| Barlow line | UML class | 159 | Descendants of Peter Barlow |
| Finch line | UML class | 113 | Descendants of Edward Finch and Susanna Scribner |
| Carter line | UML class | 282 | Descendants of Herbert Graham Carter and Eileen Doris Mildred Carter. 51 people, 13 families |
| Carter ancestry: Herbert Carter line | UML class | 136 | Kent and Norfolk |
| Carter ancestry: Samuel William line | UML class | 84 | Cornwall |
| Watkins line | UML class | 37 | Descendants of James Watkins and Elizabeth |
| Chmielewski line | UML class | 38 | Descendants of Jan and Marianna |
| Czeladka line | UML class | 42 | Descendants of Walenty and Antonina |
| Klos line | UML class | 33 | Descendants of Janusz Klos and his wife. 24 people, 9 families |
| Sources | UML class | 73 | Original Smart Match sources plus later ones |
| Genealogy Model | UML class | 4 | The three classes |
| Hypothesis: the original Barlow village | Markdown | 0 | About 15,600 characters. The case file content |

Diagram node ids follow the GEDCOM id, for example `P_I900138`. Node colour in the diagrams already encodes something (the sample is pink with a magenta border). Worth checking what before inventing a new colour scheme.

## Useful MCP calls

- `list_elements(package_id=...)` for all people, families or sources. Large: 214 people in one response.
- `list_relationships(set_id=..., relationship_type=...)`, paginated at 100, for partner, child and cites links.
- `get_element(element_id)` for one full record.
- `list_diagrams(set_id=...)` returns full diagram data. About 1 MB for this set, so save it to a file, do not read it into a prompt.

The chrisbarlow.nz collection is described as being pulled at build time through an anonymous JSON export. Whether that export is open for this collection was not checked, and for a family tree it probably should not be.
