-- Reclassify and clean the imported head-to-toe checklist. The source itself
-- identifies this as an assessment guide, not a numbered past paper.
update public.articles
set
  title = 'Head-to-Toe Clinical Examination — Revision Guide',
  category = 'Year 3: Clinical Techniques',
  content_type = 'Revision Guide',
  content_kind = 'notes',
  meta_title = 'Head-to-Toe Clinical Examination Guide | OmpathStudy',
  meta_description = 'Revise a systematic head-to-toe clinical examination with concise checklists for general inspection, head and neck, chest, abdomen and limbs.',
  content = $content$
# Head-to-Toe Clinical Examination

Use this guide as a systematic revision checklist. Adapt the examination to the patient's age, symptoms and clinical condition, explain each step, obtain consent, preserve privacy and perform hand hygiene.

## General approach

- Introduce yourself, confirm the patient's identity and explain the examination.
- Obtain consent and position the patient appropriately.
- Assess the patient's general condition, comfort and level of consciousness.
- Note age, body build, nutritional status and hydration.
- Look for pallor, jaundice, central or peripheral cyanosis and obvious skin changes.
- Note pain, respiratory distress, abnormal posture, deformity, mobility aids or unusual odour.
- Record relevant vital signs before continuing.

## Head and neck

- In infants and young children, assess the fontanelles when clinically appropriate.
- Inspect facial symmetry and assess relevant cranial nerves, including the trigeminal and facial nerves.
- Examine the eyes for position, proptosis, conjunctival pallor, scleral jaundice, pupil size and reaction, and eye movements.
- Inspect the external ears for discharge, lesions and congenital abnormalities.
- Inspect the nose for septal deviation, discharge and obstruction.
- Examine the lips, oral mucosa, teeth, tongue, palate and tonsils.
- Palpate the cervical lymph nodes, thyroid and salivary glands when indicated.

## Chest and cardiovascular system

- Inspect chest shape and symmetry; look for tracheal deviation, pectus excavatum or pectus carinatum.
- Assess respiratory rate, pattern, chest expansion and use of accessory muscles.
- Palpate chest expansion and tactile fremitus when indicated.
- Percuss the lung fields for resonance or abnormal dullness and hyperresonance.
- Auscultate for normal breath sounds and added sounds such as wheeze, crackles or stridor.
- Examine the precordium and auscultate the heart systematically.
- Examine the breasts only when clinically indicated, with consent and an appropriate chaperone.

## Abdomen

For the abdomen, use the sequence **inspection → auscultation → percussion → palpation** so palpation does not alter bowel sounds.

- Inspect the contour, movement, scars, distended veins and signs such as caput medusae.
- Auscultate bowel sounds and, when indicated, listen for vascular bruits.
- Percuss for liver span, splenic dullness, masses and ascites.
- Palpate gently away from pain, progressing from light to deep palpation.
- Assess the liver, spleen and kidneys for enlargement or tenderness.
- Test Murphy's sign when gallbladder inflammation is suspected.
- Assess renal-angle tenderness when urinary or renal disease is suspected.
- For suspected appendicitis, assess McBurney-point tenderness and consider rebound, Rovsing and psoas signs as clinically appropriate.
- Perform a digital rectal examination only when indicated, after explanation, consent and provision of a chaperone.

## Upper and lower limbs

- Inspect for symmetry, deformity, muscle wasting, tremor, clubbing, peripheral cyanosis and oedema.
- Palpate relevant lymph nodes, including axillary and inguinal nodes when indicated.
- Assess peripheral temperature, capillary refill and pulses, comparing both sides.
- Common pulses include radial, brachial, femoral, popliteal, posterior tibial and dorsalis pedis.
- Assess joint movement, muscle tone, power, reflexes, coordination and sensation according to the clinical question.
- When deep-vein thrombosis is suspected, assess for unilateral swelling, warmth and tenderness and use an approved clinical pathway. Homan's sign is unreliable and should not be used to exclude DVT.

## Completion

- Thank the patient and help them return to a comfortable position.
- Perform hand hygiene.
- Summarise the important positive and negative findings.
- State any additional focused examinations or investigations required.
$content$,
  updated_at = now()
where slug = '7867e6c4-head-to-toe-examination-past-paper';
