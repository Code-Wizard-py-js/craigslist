import requests
from bs4 import BeautifulSoup as soup
import uuid,os

dtafil=os.getcwd()+str("/Files/")
try:
    os.system("mkdir Files")
except:
    print()
try:
    os.system("mkdir mgs")
except:
    print()
def scrapedLinks():
    with open("urls.txt","r") as dus:
        
        for xc in dus:
            xr=0
            xcr=str(xc).replace("\n","")
            if "?" in str(xc):
                xurlss=str(xcr)+'&s='
            else:
                xurlss=str(xcr)+'?s='
            for x in range(0,20):
                frcp=str(xurlss)+str(xr)
                print(frcp)
                page=requests.get(frcp)
                bsobj = soup(page.content,'lxml')
                links = []
                xr+=120
                print("total pages scraped ",xr)
                lnlik=bsobj.findAll('a',{'class':'result-title hdrlnk'})
                #sprint(lnlik)
                if lnlik is None or lnlik==[]:
                    print("no links")
                    break
                for link in lnlik:
                    clinks=link['href']
                    
                    links.append(clinks)
                    
                datar=[links[i:i + 10] for i in range(0, len(links), 10)]
                for xx in datar:

                    fls=uuid.uuid4().hex
                    for xcr in xx:
                        fils=open( str(dtafil)+str(fls)+".txt","a")
                        fils.writelines(str(xcr)+"\n")
                        fils.close()

               

