#Make sure to import with "pip install selenium"
from typing import DefaultDict
from selenium.common.exceptions import TimeoutException
from selenium import webdriver
from selenium.webdriver.common import keys
from webdriver_manager import driver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
import re,os
import random,threading
import undetected_chromedriver.v2 as uc
import time
import uuid
from selenium.webdriver.common.keys import Keys
unames=os.path.expanduser(os.getenv('USERPROFILE'))
from scrape import scrapedLinks
import glob
xcpr=os.getcwd()+str("/Files/")
flmail=glob.glob(str(xcpr)+"*.txt")
try:
	os.system("taskkill /IM chromedriver.exe /F")
	#os.system("taskkill /IM chrome.exe /F")
except:
	pass
if flmail is None or flmail==[]:
    scrapedLinks()
else:
    print("already have urls ")
prorr=input("if proxy On paste proxy here else leave blank and press enter : ")
def dataphone(post):
	
	num=re.compile("\(?([0-9]{3,11})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4,11})")
	match = num.search(post)
	if match is None:
			return None
	return match.group(0)
def npphone(post):
	
	num=re.compile("(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
	match = num.search(post)
	if match is None:
			return None
	return match.group(0)
def extractPhone(post):
	num = re.compile('\d\d\d[\s_-]\d\d\d[\s_-]\d\d\d\d|\d\d\d\d\d\d\d\d\d\d|\(\d\d\d\)[\s_-]\d\d\d[\s_-]\d\d\d\d')
	#num=re.compile("(\([0-9]{1,3}\))?( )?[(\d+((\-\d+)+)]{10,15}")
	match = num.search(post)
	if match is None:
			return None
	return match.group(0)
def clbotsend(browser,fcll):
	browser.switch_to_window(browser.window_handles[1])
	time.sleep(2)
	filecq=open(str(fcll),"r")
	fildd=filecq.readlines()
	filecq.close()
	rkcsr=''.join(fildd)
	rkc=str(rkcsr).replace("\n"," <br>")
	try:
		element = WebDriverWait(browser, 5).until(lambda x: x.find_element_by_css_selector(" a[data-action='sign in']"))
		print("login manually within 5 min ")
		time.sleep(800)

	except:
		print()
	browser.find_element_by_css_selector("div[aria-label*='Message Body'] ")

	browser.execute_script("""document.querySelector("div[aria-label*='Message Body'] ").innerHTML=arguments[0]""", str(rkc))
	time.sleep(2)
	browser.execute_script(''' document.querySelector("div[data-tooltip-delay*='800']").click();''')
	print("message sent")
	browser.switch_to_window(browser.window_handles[0])
	
def browsers(its):
	option = uc.ChromeOptions()	
	
	option.user_data_dir=str(unames)+"\\AppData\Local\\Google\\Chrome\\rrf"+str(its) 
	
	option.add_argument("--log-level=3")
	
	try:
		print(str(prorr[1]))
		prxr=str(prorr)
		option.add_argument(f'--proxy-server=socks5://{prxr}')
	except:
		print()
	browser = uc.Chrome(executable_path='chromedriver.exe', options=option,service_args=['>', '/dev/null', '2>&1'])
	return browser
def has_connection(driver):
    try:
        driver.find_element_by_xpath('//span[@jsselect="heading" and @jsvalues=".innerHTML:msg"]')
        return False
    except: return True
def scraping(its,fcll):
	for frc in range(0,200):
		try:
				
				
				datafiles=glob.glob(str(xcpr)+"*.txt")
				postLinks=[]
				try:
					xfile=random.choice(datafiles)
				except:
					xfile=None
				if xfile is None or xfile==[]:
					break
				filers=open(str(xfile),'r')
				for xyr in filers:
					xyr=str(xyr).replace("\n","")
					postLinks.append(xyr)
				filers.close()
				try:
					os.remove(str(xfile))
				except Exception as er:
					print(er)
				browser=browsers(its)
				browser.set_page_load_timeout(100)
				#datafile=glob.glob("*.txt")
				browser.delete_all_cookies()
				for x in postLinks:
					#print(x)
					if x is None:
						print("no items in text file ")
						browser.quit()
						break
						
					try:
						try:
							browser.get(x)
							pcd=True
						except:
							pcd=False
						#intrcheck=has_connection(browser)
							browser.command_executor._commands['SEND_COMMAND'] = (
								'POST', '/session/$sessionId/chromium/send_command'
							)
							browser.execute('SEND_COMMAND', dict(cmd='Network.clearBrowserCache', params={}))
						if pcd:
							print(" net conneciton ok")
						else:
							print("no internet connection or proxy problem")
							print("connection will back")
							time.sleep(20)

						time.sleep(2)
						try:
								element = WebDriverWait(browser, 3).until(
									lambda x: x.find_element_by_xpath('//body[contains(text(),"Your request has been blocked.")]'))
								print("your ip blocked change plz ")
								time.sleep(120)
								browser.get(x)
						except:
								pass
						print(x)
						time.sleep(5)
						try:		
							post = browser.find_element_by_id('postingbody').get_attribute("textContent")
						except:
							browser.refresh()
							time.sleep(2)
							post = browser.find_element_by_id('postingbody').get_attribute("textContent")
						#indexed.append(extractPhone(post))
						
						kpost=str(post).lower()
						uposts=str(kpost).replace(".","").replace("one","1").replace("two","2").replace("three","3").replace("four","4").replace("five","5").replace("six","6").replace("seven","7").replace("eight","8").replace("nine","9").replace("ten",'10').replace("sero","0")
						spcr=str(extractPhone(uposts))
						spcrru=str(dataphone(uposts))
						npsphon=str(npphone(uposts))
						if "non" in str(spcrru) or "Non" in str(spcrru):
							pass
						else:
							
							file=open("phone.txt",'a')
							rpc=str(spcrru).replace(" ","").replace("\n","")
							file.writelines(str(rpc)+'\n')
							file.close()
							print(" Extreacted numbers  types1 - " +str(browser.title)+" =   [ "+  str(rpc) + " ]")
							break
						if "non" in str(npsphon) or "Non" in str(npsphon) or npsphon is None:
							pass
						else:
							
							file=open("phone.txt",'a')
							rpc=str(npsphon).replace(" ","").replace("\n","")
							file.writelines(str(rpc)+'\n')
							file.close()
							print(" Extreacted numbers  types2 - " +str(browser.title)+" =   [ "+  str(rpc) + " ]")
							break
						print(" find-- phone ",spcr, spcrru,npsphon,"   will try captcha solve")
						
						if  spcr is None or "None"  in str(spcr) or 'NONE' in str(spcr) or 'No' in str(spcr) or 'no' in str(spcr):
							#print("solving captcha-----------")
							time.sleep(5)
							try:
								print(" Trying captch solve with Show Contract")
								browser.execute_script(''' document.querySelector("a[class*='show-contact']").click() ''' )
							except:
								try:
									element = WebDriverWait(browser, 20).until(
										lambda x: x.find_element_by_css_selector("button[class*='reply-button js-only']"))
									browser.execute_script(''' document.querySelector("button[class*='reply-button js-only']").click() ''' )
									print("replay button found and click")
								except Exception as ec:
									print(ec)
									continue
							print("finding captcha button")
							time.sleep(2)
							try:
									element = WebDriverWait(browser, 10).until(
										lambda x: x.find_element_by_css_selector("iframe[title*='hCaptcha']"))
									#browser.find_element_by_css_selector("button[class*='reply-button js-only']").click()
									print("Captcha Frame display")
							except:
									#print()
									print("Captcha frame not found")
									#continue
							time.sleep(5)
							
							
							for x in range(0,10):
								time.sleep(3)
								try:
									psrr=browser.find_element_by_id('postingbody').get_attribute("textContent")
									kpostr=str(psrr).lower()
									upostsr=str(kpostr).replace(".","").replace("one","1").replace("two","2").replace("three","3").replace("four","4").replace("five","5").replace("six","6").replace("seven","7").replace("eight","8").replace("nine","9").replace("ten",'10').replace("oh","0").replace("sero","0")
					
									spcrr=str(dataphone(upostsr))

									if "non" in str(spcrr) or "Non" in str(spcrr):
										pass
									else:
										
										file=open("phone.txt",'a')
										rpc=str(spcrr).replace(" ","").replace("\n","")
										file.writelines(str(rpc)+'\n')
										file.close()
										print(" Extreacted numbers  types3 - " +str(browser.title)+" =   [ "+  str(rpc) + " ]")
										break
									spcrrc=str(extractPhone(upostsr))
									if "non" in str(spcrrc) or "Non" in str(spcrrc):
										pass
									else:
										
										file=open("phone.txt",'a')
										rpc=str(spcrrc).replace(" ","").replace("\n","")
										file.writelines(str(rpc)+'\n')
										file.close()
										print(" Extreacted numbers  types5 - " +str(browser.title)+" =   [ "+  str(rpc) + " ]")
										break
									spcrrcc=str(npphone(upostsr))
									if "non" in str(spcrrcc) or "Non" in str(spcrrcc) or spcrrcc is None:
										pass
									else:
										
										file=open("phone.txt",'a')
										rpc=str(spcrrcc).replace(" ","").replace("\n","")
										file.writelines(str(rpc)+'\n')
										file.close()
										print(" Extreacted numbers  types5 - " +str(browser.title)+" =   [ "+  str(rpc) + " ]")
										break
								except:
									pass
								try:
									try:
										element = WebDriverWait(browser, 3).until(
											lambda x: x.find_element_by_css_selector("button[class*='show-email']"))
										browser.find_element_by_css_selector("button[class*='show-phone']").click()
										time.sleep(2)
										data=browser.find_element_by_css_selector("span[id*='reply-tel-number']").get_attribute("textContent")
										data=str(data).replace(" ","").replace("\n","")
										print(" Extreacted numbers Extra - " +str(browser.title)+" =   [ "+  str(data) + " ]")
										file=open("phone.txt","a")
										
										file.writelines(str(data)+"\n")
										file.close()
										break
									except:
										print("solving captcha--")
										
										try:
											element = WebDriverWait(browser, 3).until(
												lambda x: x.find_element_by_css_selector("button[class*='show-email']"))
											browser.find_element_by_css_selector("button[class*='show-email']").click()
											time.sleep(2)

											browser.find_element_by_css_selector("p a[class*='reply-email gmail']").click()
											time.sleep(2)
											try:
												clbotsend(browser,fcll)
												break
											except:
												print()

											print("email found no phone numbers")
											break
										except :
											pass
											
									try:
										browser.find_element_by_css_selector("button[class*='show-phone']").click()
										time.sleep(3)
										
										data=browser.find_element_by_css_selector("span[id*='reply-tel-number']").get_attribute("textContent")
									#os.system("cls")
										data=str(data).replace(" ","").replace("\n","")
										print(" Extreacted numbers Extra - " +str(browser.title)+" =   [ "+  str(data) + " ]")
										
										file=open("phone.txt","a")
										file.writelines(str(data)+"\n")
										file.close()
										break
										
									except:
										pass
										#browser.find_element_by_css_selector("button[class*='show-email']").click()
										
										#break
								except Exception as ii:
									pass
								imgn= uuid.uuid4().hex
								#browser.save_screenshot(str(imgn)+".png")
								
								try:
									#os.system("cls")
									element = WebDriverWait(browser, 2).until(
										lambda x: x.find_element_by_css_selector("button[class*='show-phone']"))
									browser.find_element_by_css_selector("button[class*='show-phone']").click()
									time.sleep(3)
									#os.system("cls")
									data=browser.find_element_by_css_selector("span[id*='reply-tel-number']").get_attribute("textContent")
									#os.system("cls")
									data=str(data).replace(" ","").replace("\n","")
									print(" Extreacted numbers Extra phone show - " +str(browser.title)+" =   [ "+  str(data) + " ]")
									
									file=open("phone.txt","a")
									file.writelines(str(data)+"\n")
									file.close()
									break
									
								except Exception as iir:
									pass
									#break
									
									
								
							
						else:
							file=open("phone.txt",'a')
							file.writelines(str(spcr)+'\n')
							file.close()
							print(" Extreacted numbers  - " +str(browser.title)+" =   [ "+  str(spcr) + " ]")
								
					except Exception as eqq:
						if "already used by" in str(eqq):
							browser.quit()
				browser.quit()	
		except Exception as e:
				print(e)
				try:
					browser.quit()
				except:
					print()
threads=[]

# thread = threading.Thread(target=scraping, args=("1",))
	
# thread.start()


# input()
datarth=int(input("thread number: "))
rcdata=os.getcwd()+"/mgs/"
filescc=glob.glob(str(rcdata)+"/*.txt")
for x in range(0,int(datarth)):	
	filecr=random.choice(filescc)
	
	thread = threading.Thread(target=scraping, args=(x,filecr))
	threads.append(thread)
	thread.start()
	time.sleep(2)
	
	

			
	    	
