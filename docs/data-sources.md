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

Size: 561 elements, 13 diagrams. 214 people, 60 families, 3 original sources plus later ones.

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

Not confirmed: the field names for birth, death and place. The element `description` carries them as text on the records seen, for example "Born 21 Jul 1910. Died 1991." Read a few 19th and 20th-century records in full before designing the timeline.

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
