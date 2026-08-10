#!/bin/bash
echo "Syncing compiled contracts from deploy-test..."
SOURCE="../deploy-test/contracts/managed/private-payment"
DEST="./public/contracts/private-payment"
SRC_DEST="./src/contract"

mkdir -p "$DEST/contract" "$DEST/keys" "$DEST/zkir" "$DEST/compiler" "$SRC_DEST"
cp -r "$SOURCE/contract/"* "$DEST/contract/"
cp -r "$SOURCE/contract/"* "$SRC_DEST/"
cp -r "$SOURCE/keys/"* "$DEST/keys/"
cp -r "$SOURCE/zkir/"* "$DEST/zkir/"
cp -r "$SOURCE/compiler/"* "$DEST/compiler/"

echo "Done! Contract files synced to $DEST and $SRC_DEST"
