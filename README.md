Takes output from http://github.com/chrisjr/cataskell (specifically,
the cataskell-cli sample executable) and displays the game states therein.

To process the JSON output:

```bash
echo -n "var data=" | cat - games.json > games.js
echo ";" >> games.js
```
