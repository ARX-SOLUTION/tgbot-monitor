.PHONY: install build start stop restart logs status clean

install:
	cd backend && npm install
	cd dashboard && npm install

build:
	cd backend && npx nest build
	cd dashboard && npm run build

start:
	pm2 start ecosystem.config.js --env production

stop:
	pm2 stop tgbot-monitor

restart:
	pm2 reload ecosystem.config.js --env production

logs:
	pm2 logs tgbot-monitor --lines 100

status:
	pm2 status

clean:
	rm -rf backend/dist dashboard/dist
