for file in /Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/models/*.dart; do
  sed -i '' -e 's/fromFirestore(DocumentSnapshot doc)/fromMap(Map<String, dynamic> data, String id)/g' "$file"
  sed -i '' -e "s/final data = doc.data() as Map<String, dynamic>;//g" "$file"
  sed -i '' -e 's/id: doc.id,/id: id,/g' "$file"
done

for file in /Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/*.dart; do
  sed -i '' -e 's/_FakeDocumentSnapshot(data\[\x27id\x27\], _toCamelCase(data))/_toCamelCase(data), data[\x27id\x27]/g' "$file"
  sed -i '' -e 's/\.fromFirestore(/.fromMap(/g' "$file"
done
