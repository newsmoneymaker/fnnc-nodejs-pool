# yphash: Fennec's own yescrypt sources (yescrypt/, copied verbatim from the node's fennec/hash/yescrypt/) are the only things needed.
#   make            (STATIC=-static makes a binary that runs on any Linux)
CC ?= gcc
STATIC ?=
yphash: yphash.c yescrypt/yescrypt.c
	$(CC) -O2 -fomit-frame-pointer $(STATIC) -o $@ yphash.c yescrypt/yescrypt.c -I. -Iyescrypt
clean:
	rm -f yphash
